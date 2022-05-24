'use strict';

const axios = require('axios')

const BASE_URL = process.env.CLI_BASE_URL ? process.env.CLI_BASE_URL : 'http://cli-dev.smiling.com:7001'

const instance = axios.create({
    baseURL: BASE_URL,
    tiimeout: 5000
})

instance.interceptors.response.use(response => {
    if (response.status === 200) {
        return response.data
    }
}, error => {
    return Promise.reject(error)
})

module.exports = instance;
