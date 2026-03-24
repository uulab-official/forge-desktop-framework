export interface UpdateBannerProps {
  status: 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  progress?: number;
  error?: string;
  onDownload?: () => void;
  onInstall?: () => void;
  onDismiss?: () => void;
}

export function UpdateBanner({
  status,
  version,
  progress,
  error,
  onDownload,
  onInstall,
  onDismiss,
}: UpdateBannerProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 text-sm bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-3">
        {status === 'available' && (
          <>
            <span className="text-blue-700 dark:text-blue-300">
              Update {version} is available
            </span>
            <button
              onClick={onDownload}
              className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors"
            >
              Download
            </button>
          </>
        )}

        {status === 'downloading' && (
          <div className="flex items-center gap-3 flex-1">
            <span className="text-blue-700 dark:text-blue-300">Downloading update...</span>
            {progress !== undefined && (
              <div className="flex items-center gap-2 flex-1 max-w-xs">
                <div className="flex-1 bg-blue-200 dark:bg-blue-800 rounded-full h-1.5">
                  <div
                    className="bg-blue-600 h-1.5 rounded-full transition-all"
                    style={{ width: `${Math.round(progress)}%` }}
                  />
                </div>
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  {Math.round(progress)}%
                </span>
              </div>
            )}
          </div>
        )}

        {status === 'downloaded' && (
          <>
            <span className="text-green-700 dark:text-green-300">
              Update {version} ready to install
            </span>
            <button
              onClick={onInstall}
              className="px-3 py-1 bg-green-600 text-white text-xs rounded-md hover:bg-green-700 transition-colors"
            >
              Restart & Update
            </button>
          </>
        )}

        {status === 'error' && (
          <span className="text-red-700 dark:text-red-300">
            Update failed: {error ?? 'Unknown error'}
          </span>
        )}
      </div>

      {onDismiss && (
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 ml-2"
        >
          x
        </button>
      )}
    </div>
  );
}
