import type { Metadata } from 'next';
import AdminHomeLauncher from '../components/admin/AdminHomeLauncher';

export const metadata: Metadata = {
  title: 'Panel de administración — Mundo Mágico',
};

export default function AdminHomePage() {
  return <AdminHomeLauncher />;
}
