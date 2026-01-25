import { Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageSpinner } from '@/components/ui/Spinner';
import { TodaysGames } from '@/components/games/TodaysGames';
import { ModelAccuracyBanner } from '@/components/predictions/ModelAccuracyBanner';
import { Calendar, TrendingUp, DollarSign, AlertCircle } from 'lucide-react';

export default function HomePage() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Today&apos;s Predictions</h1>
          <p className="text-slate-400 flex items-center gap-2 mt-1">
            <Calendar className="h-4 w-4" />
            {today}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="info" className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Model Active
          </Badge>
        </div>
      </div>

      {/* Model Accuracy Banner */}
      <Suspense fallback={<div className="h-20 animate-pulse bg-slate-800 rounded-xl" />}>
        <ModelAccuracyBanner />
      </Suspense>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Games Today</p>
                <p className="text-2xl font-bold text-white">--</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Value Bets</p>
                <p className="text-2xl font-bold text-green-400">--</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">High Confidence</p>
                <p className="text-2xl font-bold text-white">--</p>
              </div>
              <TrendingUp className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Your Bets</p>
                <p className="text-2xl font-bold text-white">--</p>
              </div>
              <AlertCircle className="h-8 w-8 text-slate-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Today's Games */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-500" />
            Games & Predictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<PageSpinner />}>
            <TodaysGames />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
