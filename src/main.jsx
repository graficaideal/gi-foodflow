import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/global.css'
import App from './App'
import MobileApp from './screens/mobile/MobileApp'

// /mobile não passa pelo App: nunca carrega a lista de funcionários nem dados de outros.
const Root = window.location.pathname.replace(/\/$/, '') === '/mobile' ? MobileApp : App

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
