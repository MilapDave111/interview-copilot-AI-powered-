import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' 

import {ClerkProvider} from '@clerk/clerk-react'

const PUBLISHBLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY

if(!PUBLISHBLE_KEY){
  throw new Error ("Missing Publisher key")
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHBLE_KEY}>
    <App />
    </ClerkProvider>
  </React.StrictMode>,
)
