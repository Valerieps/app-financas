import { createContext, useContext, type ReactNode } from 'react';
import type { Backend, DeviceLock } from '../application/ports';

interface Services {
  readonly backend: Backend;
  readonly deviceLock: DeviceLock;
}

const ServicesContext = createContext<Services | null>(null);

export function ServicesProvider({ backend, deviceLock, children }: Services & { children: ReactNode }) {
  return <ServicesContext.Provider value={{ backend, deviceLock }}>{children}</ServicesContext.Provider>;
}

export function useServices(): Services {
  const services = useContext(ServicesContext);
  if (!services) throw new Error('ServicesProvider is missing');
  return services;
}
