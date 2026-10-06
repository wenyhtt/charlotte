export interface Container {
  id: number;
  name: string;
  available: number;
  ram: string;
  cpu: number;
}

export const mockContainers: Container[] = [
  { id: 0, name: "dev-server-1", available: 2, ram: "256MB", cpu: 1 },
  { id: 1, name: "dev-server-2", available: 1, ram: "512MB", cpu: 1 },
];
