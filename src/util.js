const { DateTime } = require('luxon')
const path = require('path')
const fs = require('fs')
const readLine = require('readline')
let logFile = null
let profiles = null

const appPath = (relativePath) => {
    return path.join(__dirname, relativePath)
}

const swapConfig = async () => {
    serverLog('util - Prepping mpv.conf')
    const source = appPath('bin/mpv/mpv/mpv.conf.template')
    const destination = appPath('bin/mpv/mpv/mpv.conf')
    const mpvRootDir = appPath('/bin/mpv')
    try {
        fs.unlinkSync(destination)
    } catch (swallow) {}
    profiles = ['default']
    const reader = fs.createReadStream(source)
    const writer = fs.createWriteStream(destination)
    const lineReader = readLine.createInterface({ input: reader, crlfDelay: Infinity })
    for await (const line of lineReader) {
        let swapped = line.replace('<MPV_ROOT_DIR>', mpvRootDir)
        if (process.platform === 'linux') {
            swapped = swapped.replace(/\\/g, '/')
        }
        if (swapped.indexOf('log-file') !== -1 && swapped.indexOf('#') === -1) {
            serverLog(`util - MPV will log to ${swapped.split('=')[1]}`)
        }
        if (swapped.indexOf('[') !== -1 && swapped.indexOf(']') !== -1) {
            profiles.push(swapped.replace('[', '').replace(']', ''))
        }
        writer.write(swapped + '\n')
    }
    writer.end()
}

const getMediaProfiles = () => {
    return profiles
}

const browserGetMediaProfiles = () => {
    return require('electron').ipcRenderer.sendSync('snowby-get-media-profiles')
}

const isClass = (target) => {
    try {
        new target()
    } catch (err) {
        return false
    }
    return true
}

let tippyInstances = []

const loadTooltips = () => {
    tippyInstances.forEach((instance) => {
        instance.destroy()
    })
    const tippy = require('tippy.js').default
    tippyInstances = tippy('[data-tippy-content]', {
        placement: 'bottom',
        delay: 300,
    })
}

let lastLocation = ''
let lastParams = {}
const queryParams = (target) => {
    target = target || location.search
    if (lastLocation === target) {
        return { ...lastParams }
    }
    lastLocation = target
    lastParams = require('query-string').parse(target)
    return lastParams
}

const queryString = (target) => {
    return require('query-string').stringify(target)
}

const getCaller = () => {
    // get the top most caller of the function stack for error message purposes
    const stackMatch = new Error().stack.match(/at\s\w*[^getCaller]\.\w*\s/g)
    const caller = stackMatch[stackMatch.length - 1].split('.')[1].trim() + '()'
    return caller
}

const serverLog = (message) => {
    if (!logFile) {
        logFile = appPath('snowby-ipc.log')
        // Clear the log each launch
        console.log('')
        fs.writeFileSync(logFile, '')
    }
    let stampedMessage = DateTime.local().toRFC2822() + ' - ' + message
    console.log(stampedMessage)
    fs.appendFileSync(logFile, stampedMessage + '\n')
}

const clientLog = (message) => {
    try {
        require('electron').ipcRenderer.sendSync('snowby-log', message)
    } catch (err) {
        console.log('Swallowing an error that occurred while sending a client log', { err })
    }
}

module.exports = {
    appPath,
    browserGetMediaProfiles,
    clientLog,
    getMediaProfiles,
    isClass,
    loadTooltips,
    queryParams,
    queryString,
    serverLog,
    swapConfig,
    getCaller,
}
