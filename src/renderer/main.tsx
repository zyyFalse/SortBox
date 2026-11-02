import { createRoot } from 'react-dom/client';
import { bootstrap } from './AppBootstrap';
import './styles/app.css';

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(bootstrap().view);
}
