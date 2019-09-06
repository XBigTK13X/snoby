const emby = require('../emby/api-client')
const mediaLibrary = require('../component/media-library')

emby.apiClient.connect()
    .then(()=>{
      return emby.apiClient.landingPage()   
    })
    .then((landingPage)=>{
      let renderedLibraries = ''
      landingPage.libraries.forEach(library=>{       
        if(library.CollectionType === "movies" || library.CollectionType === "tvshows"){
         renderedLibraries += library.render()  
        }        
      })
      document.getElementById('media-libraries').innerHTML = renderedLibraries       
      document.getElementById('header').innerHTML = "Media Libraries"
    })