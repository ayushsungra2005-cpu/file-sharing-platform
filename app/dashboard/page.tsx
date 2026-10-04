import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import Navbar from '@/components/Navbar';
import DashboardContent from '@/components/DashboardContent';

export default async function DashboardPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?message=Please log in to access your dashboard.');
  }

  const userEmail = user.email || 'user';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Navbar userEmail={userEmail} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardContent userEmail={userEmail} userId={user.id} />
      </main>
    </div>
  );
}
