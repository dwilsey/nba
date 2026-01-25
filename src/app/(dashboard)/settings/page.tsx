'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { User, Mail, Bell, Trash2, Shield, Save } from 'lucide-react';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  if (!session) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-slate-400">Please sign in to access settings.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-slate-400 mt-1">Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="h-5 w-5 text-blue-400" />
            Profile
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="Name"
            defaultValue={session.user?.name || ''}
            className="bg-slate-700 border-slate-600"
          />
          <Input
            label="Email"
            type="email"
            defaultValue={session.user?.email || ''}
            disabled
            className="bg-slate-700 border-slate-600"
          />
          <Button isLoading={isLoading}>
            <Save className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="h-5 w-5 text-blue-400" />
            Notifications
          </CardTitle>
          <CardDescription>Configure email notifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-white font-medium">Daily Predictions Email</p>
              <p className="text-sm text-slate-400">
                Receive today&apos;s game predictions each morning
              </p>
            </div>
            <button
              onClick={() => setEmailNotifications(!emailNotifications)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                emailNotifications ? 'bg-blue-600' : 'bg-slate-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  emailNotifications ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Data Management */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-400" />
            Data Management
          </CardTitle>
          <CardDescription>Manage your betting history and data</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-slate-700">
            <div>
              <p className="text-white font-medium">Export Bet History</p>
              <p className="text-sm text-slate-400">Download your betting data as CSV</p>
            </div>
            <Button variant="secondary" size="sm">
              Export
            </Button>
          </div>

          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-white font-medium">Clear Bet History</p>
              <p className="text-sm text-slate-400">
                Permanently delete all your logged bets
              </p>
            </div>
            <Button variant="danger" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="bg-red-900/20 border-red-800/50">
        <CardHeader>
          <CardTitle className="text-red-400 flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Delete Account</p>
              <p className="text-sm text-slate-400">
                Permanently delete your account and all associated data
              </p>
            </div>
            <Button variant="danger" size="sm">
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
