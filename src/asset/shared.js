module.exports = pageName => {
    window.lastTargetUrl = null
    window.reloadPage = targetUrl => {
        if (targetUrl) {
            if (targetUrl === window.lastTargetUrl) {
                return
            }
            window.lastTargetUrl = targetUrl
            window.history.replaceState(null, null, targetUrl)
        }
        if (targetUrl && !targetUrl.includes('play-media')) {
            document.getElementById('header').innerHTML = 'Loading...'
        }
        const settings = require('../settings')
        const _ = require('lodash')
        const util = require('../util')
        window.$ = window.jQuery = require('jquery')
        require('jquery-lazy')
        $('body').keydown(e => {
            if (e.key == 'ArrowLeft') {
                history.back()
            } else if (e.key === 'ArrowRight') {
                history.forward()
            } else if (e.key === 'MediaPlayPause') {
                require('electron').ipcRenderer.send('snowby-wake-audio')
            }
        })
        const pageOptions = require('./page-options')
        let options = {}
        if (_.has(pageOptions, pageName)) {
            options = pageOptions[pageName]
        }
        if (!options.hideNavbar) {
            require('../component/navbar').render(options.showToggleButton)
        }

        require(`../page/${pageName}`)().then(result => {
            util.loadTooltips()

            if (result) {
                if (result.enableRandomChoice) {
                    window.randomChoice = () => {
                        const choices = document.querySelectorAll('[data-target="random-action"]')
                        if (choices && choices.length > 0) {
                            choices[Math.floor(Math.random() * choices.length)].click()
                        }
                    }
                    document.getElementById('random-choice-button').setAttribute('style', '')
                }
                if (result.enableProfilePicker) {
                    let profilePicker = document.getElementById('profile-picker')
                    const queryParams = util.queryParams()
                    const player = require('../media/player')
                    if (queryParams.mediaProfile) {
                        player.setProfile(queryParams.mediaProfile)
                    } else {
                        player.setProfile(result.defaultMediaProfile)
                        queryParams.mediaProfile = result.defaultMediaProfile
                    }
                    window.changeProfile = target => {
                        player.setProfile(target.value)
                        const newParams = util.queryParams()
                        newParams.mediaProfile = target.value
                        const url = `${window.location.pathname.split('/').slice(-1)[0]}?${util.queryString(newParams)}`
                        window.reloadPage(url)
                    }
                    const pickerMarkup = `
                    <div>
                        <p>Select a media profile to use.</p>
                        <select onChange="window.changeProfile(this)">
                        ${util
                            .browserGetMediaProfiles()
                            .map((profile, ii) => {
                                return `
                                <option value="${profile}" ${queryParams.mediaProfile && profile === queryParams.mediaProfile ? 'selected="true"' : ''}/>
                                ${profile}
                                </option>
                            `
                            })
                            .join('')}
                        </select>
                    </div>
                `
                    profilePicker.innerHTML = pickerMarkup
                }
            }
            window.$lazyLoad = () => {
                $('.lazy').Lazy()
            }
            window.$lazyLoad()
            util.loadTooltips()
        })
    }
    window.reloadPage()
}
