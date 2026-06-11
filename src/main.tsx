import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import 'flag-icons/css/flag-icons.min.css'
import App from './App.tsx'
import { AuthProvider } from './context/AuthContext.tsx'
import { SplashScreen } from './SplashScreen.tsx'
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SplashScreen>
        <AuthProvider>
          <App />
        </AuthProvider>
      </SplashScreen>
    </BrowserRouter>
  </StrictMode>,
)
