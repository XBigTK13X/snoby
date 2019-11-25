const { shell } = require('electron')
const _ = require('lodash')
const settings = require('../settings')

module.exports = class EmbyItem {
    constructor(responseBody, options) {
        Object.assign(this, responseBody)

        this.Orientation = options && options.horizontal ? 'horizontal' : 'vertical'

        this.ForcedAction = options && options.action
        this.ForcedHref = options && options.externalLink
        this.ForcedImage = options && options.image
        this.ForcedTitle = options && options.title
        this.InternalLink = options && options.internalLink
        this.NextUp = options && options.nextUp
        this.SearchResultType = options && options.searchResultType
        this.DisableImage = options && options.disablePoster
        this.SearchParams = options ? (options.searchParams ? options.searchParams : {}) : {}

        this.EnableProfilePicker = this.CollectionType && this.CollectionType === 'livetv'
        this.LightTile = this.Type && this.Type === 'TvChannel'

        if (this.Path) {
            this.CleanPath = this.Path.replace('smb:', '').replace(/\//g, '\\')
        }

        this.NotFoundImage = `../asset/img/media-not-found-${this.Orientation}.png`
        this.ResumeImage = false

        let relativeAudioIndex = 1
        let relativeSubtitleIndex = 1
        if (this.MediaStreams) {
            for (let ii = 0; ii < this.MediaStreams.length; ii++) {
                let stream = this.MediaStreams[ii]
                if (stream.Type === 'Audio') {
                    stream.RelativeIndex = relativeAudioIndex
                    relativeAudioIndex++
                }
                if (stream.Type === 'Subtitle') {
                    stream.RelativeIndex = relativeSubtitleIndex
                    relativeSubtitleIndex++
                }
                stream.AbsoluteIndex = ii
                this.MediaStreams[ii] = stream
            }
        }
    }

    render() {
        const imageUrl = this.DisableImage ? null : this.getImageUrl(settings.mediaLibraryCardWidth, settings.mediaLibraryCardHeight)
        let anchor = this.getAnchor()
        let poster = this.DisableImage
            ? ``
            : `
            <div class="poster-${this.Orientation}">                
                    <img class="lazy rounded tile-${this.Orientation}${this.LightTile ? '-light' : ''}" src="${this.NotFoundImage}" data-src="${imageUrl}"/>
            </div>`
        return `      
          ${anchor}
            <div class="grid-item grid-card-${this.Orientation} rounded">                      
              ${poster}
              <div class="${this.DisableImage ? 'big-title' : 'title'}">
                ${this.getTitle(false)}      
              </div>          
              <div class="fidelity">
                ${this.getFidelity()}
              </div>
            </div>
          </a>
        `
    }

    getTitle(enableSeriesName) {
        let result = ''
        if (this.ForcedTitle) {
            result = this.ForcedTitle
        } else {
            if (this.Type === 'Episode') {
                result = ''
                if (enableSeriesName) {
                    result += this.SeriesName + ' - '
                }
                result += this.SeasonName.replace('Season ', 'S').replace('Specials', 'SP') + 'E' + this.IndexNumber
                if (this.showSpoilers()) {
                    result = result + ' - ' + this.Name
                } else {
                    if (this.NextUp) {
                        return 'Next Up - ' + result
                    }
                    return result + ' - [Hidden]'
                }
            } else {
                if (this.ChannelNumber) {
                    result = `${this.Name} (${this.ChannelNumber})`
                } else {
                    result = this.Name
                }
            }
        }
        return result
    }

    showSpoilers() {
        if (this.Type === 'Episode') {
            if (_.has(this.UserData, 'PlaybackPositionTicks') && this.UserData.PlaybackPositionTicks > 0) {
                return true
            }
            return _.has(this.UserData, 'Played') && this.UserData.Played
        }
        return true
    }

    getImageUrl(width, height) {
        if (this.ForcedImage) {
            return this.ForcedImage
        }
        // Don't show thumbnails for episodes you haven't seen yet
        if (!this.showSpoilers()) {
            return this.NotFoundImage
        }
        if (Object.keys(this.ImageTags).length > 0) {
            let itemId = this.Id
            let imageType = 'Primary'
            if (!_.has(this.ImageTags, imageType) && _.has(this.ImageTags, 'Thumb')) {
                imageType = 'Thumb'
            }
            let imageTag = this.ImageTags[imageType]

            if (this.ResumeImage) {
                if (_.has(this.ImageTags, 'Thumb')) {
                    imageType = 'Thumb'
                    imageTag = ImageTags[imageType]
                }
            }

            if (this.Type === 'Episode' && this.ResumeImage) {
                itemId = this.ParentThumbItemId
                imageType = 'Thumb'
                imageTag = ParentThumbImageTag
            }

            var result = settings.embyServerURL + '/emby/Items/' + itemId + '/Images/' + imageType
            result += '?maxWidth=' + width + '&maxHeight=' + height
            result += '&tag=' + imageTag + '&quality=100'
            return result
        }
        if (this.Type === 'Season') {
            var result = settings.embyServerURL + '/emby/Items/' + this.SeriesId + '/Images/Primary'
            result += '?maxWidth=' + width + '&maxHeight=' + height
            result += '&tag=' + this.SeriesPrimaryImageTag + '&quality=100'
            return result
        }
        return this.NotFoundImage
    }

    isCollection() {
        if (!_.isNil(this.CollectionType)) {
            if (this.CollectionType === 'movies' || this.CollectionType === 'tvshows') {
                return true
            }
        }
        return false
    }

    getAnchor() {
        if (this.ForcedHref) {
            return `<a data-target="action" href='#' onclick="require('electron').shell.openExternal('${this.ForcedHref}'); return false;">`
        }
        if (this.ForcedAction) {
            return `<a data-target="action" href="#" onclick="${this.ForcedAction}">`
        }
        if (this.InternalLink) {
            return `<a data-target="action" href="${this.InternalLink}">`
        }
        if (this.Type === 'TvChannel') {
            return `<a data-target="action" href='#' onclick="require('../media/player').openStream('${this.getStreamURL()}',false); return false;">`
        }
        if (this.Type === 'Movie' || this.Type === 'Episode') {
            return `<a data-target="action" href="./play-media.html?embyItemId=${this.Id}">`
        }
        let url = `./emby-item.html?embyItemId=${this.Id}`
        if (this.SearchParams.IncludeItemTypes) {
            url += `&includeItemTypes=${this.SearchParams.IncludeItemTypes}`
        }
        return `<a data-target="action" href="${url}">`
    }

    getFidelity() {
        if (this.SearchResultType) {
            return this.SearchResultType
        }
        if (this.ChannelNumber) {
            return this.CurrentProgram.Name
        }
        if (this.UserData && this.UserData.UnplayedItemCount > 0) {
            return this.UserData.UnplayedItemCount + ' New Episode' + (this.UserData.UnplayedItemCount > 1 ? 's' : '')
        }
        if (this.MediaStreams) {
            let videoFidelity = ''
            let audioFidelity = ''
            for (let ii = 0; ii < this.MediaStreams.length; ii++) {
                let stream = this.MediaStreams[ii]
                if (stream.Type === 'Video' && (stream.IsDefault || videoFidelity === '')) {
                    videoFidelity = stream.DisplayTitle
                    if (!videoFidelity.toLowerCase().includes(stream.Codec.toLowerCase())) {
                        videoFidelity += stream.Codec
                    }
                }
                if (stream.Type === 'Audio' && (stream.IsDefault || audioFidelity === '')) {
                    audioFidelity = stream.DisplayTitle.replace('(Default)', '')
                    if (stream.DisplayLanguage) {
                        audioFidelity = audioFidelity.replace(stream.DisplayLanguage, '')
                    }
                    audioFidelity = audioFidelity.replace('Und', '').replace('Undefined', '')
                    if (!audioFidelity.toLowerCase().includes(stream.Codec.toLowerCase())) {
                        audioFidelity += stream.Codec
                    }
                    audioFidelity = audioFidelity.replace('Dolby Digital', 'DD')
                }
            }
            let contentType = ''
            if (this.Path) {
                if (this.Path.includes('Remux')) {
                    contentType = 'RX '
                } else {
                    contentType = 'TC '
                }
            }
            return contentType + videoFidelity.trim() + ' ' + audioFidelity.trim()
        }
        return ''
    }

    getStreamURL() {
        if (this.ChannelNumber) {
            return `${settings.homeRunURL}/v${this.ChannelNumber}`
        }
        return '#'
    }
}
