const axios = require('axios')
const settings = require('../settings')

class HttpClient {
    constructor(baseURL) {
        this.config = {
            baseURL: baseURL,
            timeout: 30000,
            headers: {},
        }
        this.newAxios()
    }

    newAxios() {
        this.client = axios.create(this.config)
        if (settings.debugApiCalls) {
            this.client.interceptors.request.use(request => {
                console.log({ request })
                return request
            })

            this.client.interceptors.response.use(response => {
                console.log({ response })
                return response
            })
        }
    }

    setHeader(key, value) {
        this.config.headers[key] = value
        this.newAxios()
    }

    get(url, data, options) {
        return this.wrap('get', url, data, options)
    }

    post(url, data, options) {
        return this.wrap('post', url, data, options)
    }

    wrap(method, url, data, options) {
        if (!window.loadingCount) {
            window.loadingCount = 1
        } else {
            window.loadingCount++
        }
        window.updateLoading()
        return new Promise(resolve => {
            return this.client[method](url, data)
                .then(result => {
                    if (settings.debugApiCalls && options && !options.quiet) {
                        console.log({ method, url, data, result, config: this.config })
                    }
                    window.loadingCount--
                    window.updateLoading()
                    return resolve(result)
                })
                .catch(err => {
                    if (options && !options.quiet) {
                        console.log({
                            place: 'http-client.wrap',
                            err,
                            method,
                            url,
                            data,
                            config: this.config,
                            time: new Date().toString(),
                        })
                    }
                    window.loadingCount--
                    window.updateLoading()
                    return resolve()
                })
        })
    }
}

module.exports = HttpClient
