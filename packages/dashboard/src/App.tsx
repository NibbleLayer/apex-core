import { Route } from '@solidjs/router';
import { Layout } from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Services from './pages/Services';
import ServiceDetail from './pages/ServiceDetail';
import Events from './pages/Events';
import Settlements from './pages/Settlements';
import Settings from './pages/Settings';

export default function App() {
  return (
    <>
      <Route path="/login" component={Login} />
      <Route path="/" component={Layout}>
        <Route path="/" component={Dashboard} />
        <Route path="/services" component={Services} />
        <Route path="/services/:id" component={ServiceDetail} />
        <Route path="/events" component={Events} />
        <Route path="/settlements" component={Settlements} />
        <Route path="/settings" component={Settings} />
      </Route>
    </>
  );
}
