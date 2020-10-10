const os = require('os')
const _ = require('lodash')

const { DateTime, Duration } = require('luxon')
const util = require('../util')
const settings = require('../settings')
const HttpClient = require('./http-client')
const EmbyItem = require('./emby-item')

const EMBY_AUTH_HEADER = 'X-Emby-Authorization'

class EmbyClient {
    constructor() {
        this.httpClient = new HttpClient(`${settings.embyServerURL}/emby/`)
        this.authHeader = null
        this.userId = null
    }

    heartBeat() {
        return new Promise((resolve) => {
            if (!this.authHeader || !this.userId) {
                return resolve(false)
            }
            const url = `System/Info`
            this.httpClient
                .get(url, null, { quiet: true, cache: true })
                .then((result) => {
                    resolve(!!result)
                })
                .catch(() => {
                    resolve(false)
                })
        })
    }

    login() {
        this.authHeader = `MediaBrowser Client="Snowby", Device="${os.hostname()}", DeviceId="${os.hostname()}", Version="1.0.0.0"`
        const usersURL = 'users/public'
        return this.httpClient
            .get(usersURL, null, { cache: true })
            .then((usersResponse) => {
                const user = usersResponse.data[0]
                const loginPayload = {
                    Username: user.Name,
                    Pw: '',
                }
                this.userId = user.Id
                this.httpClient.setHeader(EMBY_AUTH_HEADER, this.authHeader)
                const loginURL = 'users/authenticatebyname'
                return this.httpClient.post(loginURL, loginPayload)
            })
            .then((loginResponse) => {
                const authenticatedUser = loginResponse.data
                this.authHeader = `${this.authHeader}, Token="${authenticatedUser.AccessToken}"`
                window.localStorage.setItem(EMBY_AUTH_HEADER, this.authHeader)
                window.localStorage.setItem('SnowbyUserId', this.userId)
                this.httpClient.setHeader(EMBY_AUTH_HEADER, this.authHeader)
                return true
            })
    }

    connect() {
        return new Promise((resolve) => {
            this.heartBeat().then((heartBeatResult) => {
                if (heartBeatResult) {
                    return resolve(true)
                } else {
                    let authToken = window.localStorage.getItem(EMBY_AUTH_HEADER)
                    let userId = window.localStorage.getItem('SnowbyUserId')
                    if (authToken) {
                        this.authHeader = authToken
                        this.userId = userId
                        this.httpClient.setHeader(EMBY_AUTH_HEADER, this.authHeader)
                        return this.heartBeat().then((heartBeatRetryResult) => {
                            if (heartBeatRetryResult) {
                                return resolve(true)
                            } else {
                                return this.login().then(() => {
                                    resolve(true)
                                })
                            }
                        })
                    } else {
                        return this.login().then(() => {
                            resolve(true)
                        })
                    }
                }
            })
        })
    }

    libraryViews() {
        const url = `Users/${this.userId}/Views`
        return this.httpClient.get(url).then((viewsResponse) => {
            return viewsResponse.data.Items.map((item) => new EmbyItem(item))
        })
    }

    embyItem(itemId) {
        const client = this
        const url = `Users/${this.userId}/Items/${itemId}`
        return this.httpClient
            .get(url)
            .then((itemResponse) => {
                const result = new EmbyItem(itemResponse.data)
                if (result.Type !== 'Episode') {
                    return result
                }
                return client.embyItem(result.SeriesId).then((seriesItem) => {
                    result.Series = seriesItem
                    return result
                })
            })
            .then((result) => {
                return client.specialFeatures(itemId).then((specialFeatures) => {
                    result.SpecialFeatures = specialFeatures
                    return result
                })
            })
    }

    embyItems(parentId, searchParams) {
        const query = util.queryString(searchParams)
        const url = `Users/${this.userId}/Items?${query}`
        return this.httpClient.get(url).then((itemsResponse) => {
            return itemsResponse.data.Items.map((item) => new EmbyItem(item))
        })
    }

    seasons(seriesId) {
        const seasonsUrl = `Shows/${seriesId}/Seasons?UserId=${this.userId}`
        const nextUpUrl = `Shows/NextUp?SeriesId=${seriesId}&UserId=${this.userId}&Fields=PrimaryImageAspectRatio%2CMediaStreams&Limit=1&EnableTotalRecordCount=false`
        return Promise.all([this.httpClient.get(seasonsUrl), this.httpClient.get(nextUpUrl)]).then((responses) => {
            let results = []
            let nextUp = responses[1].data.Items[0]
            if (nextUp) {
                results.push(new EmbyItem(nextUp, { nextUp: true }))
            }
            results = results.concat(responses[0].data.Items.map((item) => new EmbyItem(item)))
            return results
        })
    }

    episodes(seriesId, seasonId) {
        const query = util.queryString({
            seasonId,
            userId: this.userId,
            Fields: 'MediaStreams,Path',
        })
        const url = `Shows/${seriesId}/Episodes?${query}`
        return this.httpClient.get(url).then((episodesResponse) => {
            return episodesResponse.data.Items.map((item) => new EmbyItem(item))
        })
    }

    updateProgress(embyItemId, playbackPositionTicks, runTimeTicks) {
        if (!settings.embyTrackProgress) {
            return Promise.resolve()
        }
        playbackPositionTicks = Math.floor(playbackPositionTicks)
        if (this.lastProgressUpdate) {
            if (
                this.lastProgressUpdate.embyItemId === embyItemId &&
                this.lastProgressUpdate.playbackPositionTicks === playbackPositionTicks &&
                this.lastProgressUpdate.runTimeTicks === runTimeTicks
            ) {
                return Promise.resolve()
            }
        }
        const url = `Users/${this.userId}/Items/${embyItemId}/UserData`
        const payload = {
            PlaybackPositionTicks: playbackPositionTicks,
        }
        const positionPercent = Math.round((playbackPositionTicks / runTimeTicks) * 100)
        if (positionPercent <= settings.progressWatchedThreshold.minPercent) {
            payload.PlaybackPositionTicks = 0
            payload.Played = false
        } else if (positionPercent >= settings.progressWatchedThreshold.maxPercent) {
            payload.PlaybackPositionTicks = 0
            payload.Played = true
        }
        return this.httpClient.post(url, payload).then(() => {
            this.lastProgressUpdate = {
                embyItemId,
                playbackPositionTicks,
                runTimeTicks,
            }
            return Promise.resolve()
        })
    }

    markPlayed(embyItemId) {
        if (!settings.embyTrackProgress) {
            return Promise.resolve()
        }
        const payload = {
            PlaybackPositionTicks: 0,
            Played: true,
        }
        const url = `Users/${this.userId}/Items/${embyItemId}/UserData`
        return this.httpClient.post(url, payload)
    }

    markUnplayed(embyItemId) {
        if (!settings.embyTrackProgress) {
            return Promise.resolve()
        }
        const payload = {
            PlaybackPositionTicks: 0,
            Played: false,
        }
        const url = `Users/${this.userId}/Items/${embyItemId}/UserData`
        return this.httpClient.post(url, payload)
    }

    search(query) {
        const movieURL = this.buildSearchURL(query, 'Movie')
        const seriesURL = this.buildSearchURL(query, 'Series')
        const episodeURL = this.buildSearchURL(query, 'Episode')
        return Promise.all([this.httpClient.get(seriesURL), this.httpClient.get(movieURL), this.httpClient.get(episodeURL)]).then((responses) => {
            return [
                responses[0].data.Items.map((item) => new EmbyItem(item, { showSpoilers: true })),
                responses[1].data.Items.map((item) => new EmbyItem(item, { showSpoilers: true })),
                responses[2].data.Items.map((item) => new EmbyItem(item, { showSpoilers: true })),
            ]
        })
    }

    buildSearchURL(query, itemType) {
        const encodedQuery = encodeURIComponent(query)
        let url = `Users/${this.userId}/Items?searchTerm=${encodedQuery}`
        url += `&IncludePeople=false&IncludeMedia=true&IncludeGenres=false&IncludeStudios=false&IncludeArtists=false`
        url += `&IncludeItemTypes=${itemType}&Limit=10`
        url += `&Fields=PrimaryImageAspectRatio%2CCanDelete%2CBasicSyncInfo%2CProductionYear&Recursive=true`
        url += `&EnableTotalRecordCount=false&ImageTypeLimit=1`
        return url
    }

    itemsInProgress() {
        const url = `Users/${this.userId}/Items/Resume?ImageTypeLimit=1&EnableImageTypes=Primary,Backdrop,Thumb`
        return this.httpClient.get(url).then((progressResponse) => {
            return progressResponse.data.Items.map((item) => {
                return new EmbyItem(item, { isSearchResult: true })
            })
        })
    }

    playlist(embyItemId) {
        const fields = 'ProductionYear,MediaStreams,Path'
        const url = `Playlists/${embyItemId}/Items?EnableImageTypes=Primary%2CBackdrop%2CBanner%2CThumb&UserId=${this.userId}&Fields=${fields}`
        return this.httpClient.get(url).then((playlistResponse) => {
            return playlistResponse.data.Items.map((item) => {
                return new EmbyItem(item)
            })
        })
    }

    liveChannels() {
        const fields = `PrimaryImageAspectRatio%2CChannelInfo%2CSortName%2CMediaSources`
        const url = `LiveTv/Channels?UserId=${this.userId}&ImageTypeLimit=1&EnableImageTypes=Primary%2CBackdrop%2CBanner%2CThumb&EnableTotalRecordCount=false&StartIndex=0&Limit=400&Fields=${fields}`
        window.duplicateChannels = {}
        window.channelCategories = {
            lookup: { ALL: true },
            list: ['ALL'],
        }
        return this.httpClient.get(url).then((channelsResponse) => {
            return channelsResponse.data.Items.map((item) => {
                let embyItem = new EmbyItem(item)
                embyItem.processChannelInfo()
                if (!_.has(window.duplicateChannels, embyItem.ChannelSlug)) {
                    window.duplicateChannels[embyItem.ChannelSlug] = {
                        index: 0,
                        items: [],
                    }
                }
                if (!_.has(window.channelCategories.lookup, embyItem.ChannelCategory)) {
                    window.channelCategories.lookup[embyItem.ChannelCategory] = true
                    window.channelCategories.list.push(embyItem.ChannelCategory)
                    window.channelCategories.list.sort()
                }
                window.duplicateChannels[embyItem.ChannelSlug].items.push(embyItem)
                if (window.duplicateChannels[embyItem.ChannelSlug].items.length === 1) {
                    return embyItem
                }
                window.duplicateChannels[embyItem.ChannelSlug].index += 1
                return null
            })
                .filter((x) => {
                    return x !== null
                })
                .sort((a, b) => {
                    if (a.ChannelCategory !== b.ChannelCategory) {
                        return a.ChannelCategory > b.ChannelCategory ? 1 : -1
                    }
                    return a.ChannelName > b.ChannelName ? 1 : -1
                })
        })
    }

    tvGuide() {
        const startDate = DateTime.utc()
        const duration = Duration.fromObject({ hours: 6 })
        const endDate = startDate.plus(duration)
        const url = `LiveTv/EPG?Limit=3000&MaxStartDate=${endDate.toISO()}&MinEndDate=${startDate.toISO()}&AddCurrentProgram=true&EnableUserData=false&UserId=${
            this.userId
        }`
        window.duplicateChannels = {}
        window.channelCategories = {
            lookup: { ALL: true },
            list: ['ALL'],
        }
        return this.httpClient.get(url).then((guideResponse) => {
            return guideResponse.data.Items.map((item) => {
                item.Channel.Programs = item.Programs
                let embyItem = new EmbyItem(item.Channel)
                embyItem.processChannelInfo()
                if (!_.has(window.duplicateChannels, embyItem.ChannelSlug)) {
                    window.duplicateChannels[embyItem.ChannelSlug] = {
                        index: 0,
                        items: [],
                    }
                }
                if (!_.has(window.channelCategories.lookup, embyItem.ChannelCategory)) {
                    window.channelCategories.lookup[embyItem.ChannelCategory] = true
                    window.channelCategories.list.push(embyItem.ChannelCategory)
                    window.channelCategories.list.sort()
                }
                window.duplicateChannels[embyItem.ChannelSlug].items.push(embyItem)
                if (window.duplicateChannels[embyItem.ChannelSlug].items.length === 1) {
                    return embyItem
                }
                window.duplicateChannels[embyItem.ChannelSlug].index += 1
                window.duplicateChannels[embyItem.ChannelSlug].items[0].ChannelCount += 1
                return null
            })
                .filter((x) => {
                    return x !== null
                })
                .sort((a, b) => {
                    if (a.ChannelCategory !== b.ChannelCategory) {
                        return a.ChannelCategory > b.ChannelCategory ? 1 : -1
                    }
                    return a.ChannelName > b.ChannelName ? 1 : -1
                })
        })
    }

    genres(filter) {
        let genreFilter = `Series%2CMovie`
        if (filter) {
            genreFilter = filter
        }
        let url = `Genres?SortBy=SortName&SortOrder=Ascending&Recursive=true&Fields=BasicSyncInfo%2CMediaSourceCount%2CSortName&IncludeItemTypes=${genreFilter}`
        return this.httpClient.get(url).then((genresResponse) => {
            return genresResponse.data.Items.sort((a, b) => {
                return a.Name > b.Name ? 1 : -1
            })
                .map((x) => {
                    x.Name = x.Name.replace('/', ' ').replace('.', ' ')
                    return x
                })
                .map((x) => {
                    return new EmbyItem(x)
                })
        })
    }

    buildImageURL(itemId, imageTag, width, height) {
        width *= 2
        height *= 2
        let result = `${settings.embyServerURL}/emby/Items/${itemId}/Images/Primary`
        result += '?maxWidth=' + width + '&maxHeight=' + height
        result += '&tag=' + imageTag + '&quality=100'
        return result
    }

    nextUp() {
        const nextUpUrl = `Shows/NextUp?Limit=200&Fields=MediaStreams,Path,PrimaryImageAspectRatio%2CSeriesInfo%2CDateCreated%2CBasicSyncInfo&UserId=${this.userId}&ImageTypeLimit=1&EnableImageTypes=Primary%2CBackdrop%2CBanner%2CThumb&EnableTotalRecordCount=false`
        const parentUrl = `Users/${this.userId}/Items?SortBy=SortName&SortOrder=Ascending&IncludeItemTypes=Series&Recursive=true&Fields=BasicSyncInfo%2CMediaSourceCount%2CSortName&Filters=IsUnplayed`
        let parentLookup = {}
        return Promise.all([this.httpClient.get(nextUpUrl), this.httpClient.get(parentUrl)]).then((responses) => {
            let nextUpResponse = responses[0]
            let parentResponse = responses[1]
            parentResponse.data.Items.forEach((item) => {
                parentLookup[item.Id] = item
            })
            return nextUpResponse.data.Items.filter((x) => {
                // Don't show any season that isn't in progress in this view.
                // If you watched at least two episodes, then assume in progress.
                if (x.SeasonName === 'Season 1') {
                    return x.IndexNumber && x.IndexNumber > 2
                }
                return x.IndexNumber && x.IndexNumber > 1
            })
                .sort((a, b) => {
                    return a.SeriesName > b.SeriesName ? 1 : -1
                })
                .map((x) => {
                    let unwatchedCount = 0
                    if (_.has(parentLookup, x.SeriesId)) {
                        let currentParent = parentLookup[x.SeriesId]
                        if (currentParent.UserData && currentParent.UserData.UnplayedItemCount) {
                            unwatchedCount = currentParent.UserData.UnplayedItemCount
                        }
                    }
                    return new EmbyItem(x, { showParentImage: true, unwatchedCount: unwatchedCount })
                })
        })
    }

    person(personId) {
        const personUrl = `/Users/${this.userId}/Items?SortOrder=Ascending&IncludeItemTypes=Series%2CMovie&Recursive=true&Fields=People%2CAudioInfo%2CSeriesInfo%2CParentId%2CPrimaryImageAspectRatio%2CBasicSyncInfo%2CProductionYear%2CAudioInfo%2CSeriesInfo%2CParentId%2CPrimaryImageAspectRatio%2CBasicSyncInfo%2CProductionYear&IncludePeople=true&StartIndex=0&CollapseBoxSetItems=false&SortBy=SortName&PersonIds=${personId}&EnableTotalRecordCount=false`
        return this.httpClient.get(personUrl).then((response) => {
            return response.data.Items.map((item) => {
                let foundPerson = null
                for (let ii = 0; ii < item.People.length; ii++) {
                    if (item.People[ii].Id === personId) {
                        foundPerson = item.People[ii]
                        break
                    }
                }
                let tooltip = `
                    <div class='centered'>
                        <p>
                            ${foundPerson.Name.split('"').join("'")}
                        </p>
                        <p>as</p>
                        <p>
                            ${foundPerson.Role ? foundPerson.Role.split('"').join("'") : foundPerson.Type.split('"').join("'")}
                        </p>
                        <p>in</p>
                        <p>
                            ${item.Name}
                        </p>
                    </div>
                    `
                return new EmbyItem(item, { tooltip: tooltip })
            })
        })
    }

    specialFeatures(embyItemId) {
        const url = `/Users/${this.userId}/Items/${embyItemId}/SpecialFeatures`
        return this.httpClient.get(url).then((response) => {
            return response.data.map((item) => {
                let tooltip = `
                    <div class='centered'>
                        <p>
                            ${item.Name}
                        </p>
                    </div>
                    `

                return new EmbyItem(item, { tooltip: tooltip, href: 'play-media.html?embyItemId=' + item.Id })
            })
        })
    }

    tags() {
        const url = `/Tags`
        return this.httpClient.get(url).then((response) => {
            return response.data.Items
        })
    }

    addTag(embyItemId, tag) {
        const url = `/Items/${embyItemId}/Tags/Add`
        const payload = {
            Tags: [
                {
                    Name: tag.Name,
                    Id: tag.Id,
                },
            ],
        }
        return this.httpClient.post(url, payload)
    }
}

const instance = new EmbyClient()

module.exports = {
    client: instance,
}
