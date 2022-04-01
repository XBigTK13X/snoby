module.exports = () => {
    return new Promise((resolve, reject) => {
        const emby = require('../../common/emby-client').client
        const util = require('../../common/util')
        // Helps prevent dangling MPV media sessions when flipping through Snowby
        util.killMpv()
        const settings = require('../../common/settings')
        const InternalLink = require('../component/internal-link')
        const EmbyItemLink = require('../component/emby-item-link')
        const ExternalLink = require('../component/external-link')
        const links = [
            new InternalLink('Library', 'library.html'),
            new EmbyItemLink('Next Up', 'next-up'),
            new EmbyItemLink('In Progress', 'in-progress'),
            new InternalLink('Search', 'search.html'),
        ]

        let markup = `<div class="grid center-grid">${links
            .map((link) => {
                return link.render()
            })
            .join('')}</div>`

        let versionMarkup = ''
        if (settings.availableUsers) {
            window.selectUser = (userIndex) => {
                util.window.localStorage.setItem('chosen-user-index', userIndex)
                emby.clearSession()
                return emby.connect().then(() => {
                    window.location.href = `./landing.html`
                })
            }

            versionMarkup += `<div class="grid center-grid">${settings.availableUsers
                .map((user, userIndex) => {
                    let selectionClass =
                        user.id === util.window.localStorage.getItem('SnowbyUserId', this.userId)
                            ? ' profile-image-selected'
                            : ' profile-image-unselected'
                    return `<a class="grid-item square-grid-item${selectionClass} profile-image-link" href="" onclick="window.selectUser(${userIndex});return false" data-tippy-content="<div class='snowby-tooltip'>${
                        user.username
                    }</div>">
                        <img class="profile-image rounded " src="${emby.imageUrl(user.id, user.imageTag)}" />
                    </a>`
                })
                .join('')}</div>`
        }
        versionMarkup += `<p>v${settings.appVersion} built ${settings.versionDate}</p>`
        if (settings.newVersionAvailable) {
            versionMarkup += `<br/><div class="badge badge-best">New version available, v${settings.newVersion}</div>`
        }
        document.getElementById('version').innerHTML = versionMarkup
        document.getElementById('menu-entries').innerHTML = markup
        document.getElementById('header').innerHTML = 'Snowby'
        resolve()
    })
}
