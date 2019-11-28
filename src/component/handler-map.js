const handlers = require('./handlers')
const navbar = require('../component/navbar')
const _ = require('lodash')

const collectionHandlers = {
    boxsets: handlers.collections,
    livetv: handlers.liveTv,
    movies: handlers.movieList,
    playlists: handlers.playlistList,
    tvshows: handlers.tvShowList,
}

const typeHandlers = {
    BoxSet: handlers.boxSet,
    Playlist: handlers.playlist,
    Season: handlers.tvSeason,
    Series: handlers.tvSeries,
}

const getHandler = (emby, itemId) => {
    return new Promise(resolve => {
        if (itemId === 'in-progress') {
            return resolve({ handler: inProgress })
        }
        if (itemId === 'genres') {
            return resolve({ handler: genreList })
        }
        return emby.embyItem(itemId).then(embyItem => {
            navbar.render(embyItem.isCollection())
            if (embyItem.Type === 'Genre') {
                return resolve({ handler: genre, item: embyItem })
            }
            if (!_.isNil(embyItem.CollectionType)) {
                if (_.has(collectionHandlers, embyItem.CollectionType)) {
                    return resolve({ handler: collectionHandlers[embyItem.CollectionType], item: embyItem })
                }
                throw 'Unhandled emby collection type ' + embyItem.CollectionType
            }
            if (_.has(typeHandlers, embyItem.Type)) {
                return resolve({ handler: typeHandlers[embyItem.Type], item: embyItem })
            }
            throw 'Unhandled emby item type ' + embyItem.Type
        })
    })
}

module.exports = {
    getHandler,
}
