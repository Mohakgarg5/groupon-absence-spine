import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StateProvider } from './state';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StateProvider>
      <App />
    </StateProvider>
  </StrictMode>,
);
