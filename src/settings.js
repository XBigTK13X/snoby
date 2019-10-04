module.exports = {
    debugApiCalls: false,
    embyServerURL: 'http://9914.us:8096',
    embyTrackProgress: true,
    fullScreen: true,
    homeRunURL: 'http://192.168.1.248:5004/auto',
    mediaLibraryCardHeight: '300',
    mediaLibraryCardWidth: '200',
    menuBarVisible: false,
    mpcExePath: 'C:\\Program Files\\MPC-HC\\mpc-hc64.exe',
    mpcServerURL: 'http://localhost:13579',
    mpvExePath: __dirname + '/bin/mpv/mpv.exe',
    progressUpdateInterval: 3000,
    spawnOptions: {
        stdio: 'ignore',
        detached: true,
    },
    windowBackgroundColor: '#010101',
}
