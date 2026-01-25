import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="md:flex md:items-center md:justify-between">
          <div className="text-center md:text-left">
            <p className="text-sm text-slate-500">
              &copy; {new Date().getFullYear()} NBA Predict. For entertainment purposes only.
            </p>
          </div>

          <div className="mt-4 flex justify-center space-x-6 md:mt-0">
            <Link
              href="/about"
              className="text-sm text-slate-500 hover:text-slate-400"
            >
              About
            </Link>
            <Link
              href="/methodology"
              className="text-sm text-slate-500 hover:text-slate-400"
            >
              Methodology
            </Link>
            <Link
              href="/disclaimer"
              className="text-sm text-slate-500 hover:text-slate-400"
            >
              Disclaimer
            </Link>
          </div>
        </div>

        <div className="mt-6 border-t border-slate-800 pt-6">
          <p className="text-xs text-slate-600 text-center">
            <strong>Disclaimer:</strong> This website is for informational and entertainment purposes only.
            Predictions are based on statistical models and do not guarantee results.
            Sports betting involves risk. Please gamble responsibly and only bet what you can afford to lose.
            If you or someone you know has a gambling problem, call 1-800-GAMBLER.
          </p>
        </div>
      </div>
    </footer>
  );
}
