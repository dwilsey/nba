'use client';

import { Spinner } from './Spinner';
import { Button } from './Button';
import { AlertCircle, RefreshCw, Inbox } from 'lucide-react';

interface DataStateProps {
  isLoading: boolean;
  isError: boolean;
  isEmpty?: boolean;
  onRetry?: () => void;
  loadingMessage?: string;
  errorMessage?: string;
  emptyMessage?: string;
  emptyDescription?: string;
  children: React.ReactNode;
}

export function DataState({
  isLoading,
  isError,
  isEmpty = false,
  onRetry,
  loadingMessage = 'Loading...',
  errorMessage = 'Failed to load data',
  emptyMessage = 'No data available',
  emptyDescription,
  children,
}: DataStateProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Spinner size="lg" />
        <p className="mt-4 text-slate-400">{loadingMessage}</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-12 w-12 text-red-400" />
        <p className="mt-4 text-lg text-slate-300">{errorMessage}</p>
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry} className="mt-4">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        )}
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Inbox className="h-12 w-12 text-slate-500" />
        <p className="mt-4 text-lg text-slate-300">{emptyMessage}</p>
        {emptyDescription && (
          <p className="mt-2 text-sm text-slate-500">{emptyDescription}</p>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Spinner size="lg" />
      <p className="mt-4 text-slate-400">{message}</p>
    </div>
  );
}

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = 'Failed to load data',
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <AlertCircle className="h-12 w-12 text-red-400" />
      <p className="mt-4 text-lg text-slate-300">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-4">
          <RefreshCw className="mr-2 h-4 w-4" />
          Retry
        </Button>
      )}
    </div>
  );
}

interface EmptyStateProps {
  message?: string;
  description?: string;
}

export function EmptyState({
  message = 'No data available',
  description,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Inbox className="h-12 w-12 text-slate-500" />
      <p className="mt-4 text-lg text-slate-300">{message}</p>
      {description && <p className="mt-2 text-sm text-slate-500">{description}</p>}
    </div>
  );
}
