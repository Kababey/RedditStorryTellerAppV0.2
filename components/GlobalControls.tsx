import React from 'react';
import { LoadingSpinner } from './Icons';

interface GlobalControlsProps {
    onGenerate: () => void;
    onDownloadSelected: () => void;
    onSelectAll: (isSelected: boolean) => void;
    onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void;
    isGenerating: boolean;
    isGenerateDisabled: boolean;
    generationProgress: { current: number; total: number };
    selectedCount: number;
    allSelected: boolean;
    totalStories: number;
}

const GlobalControls: React.FC<GlobalControlsProps> = ({
    onGenerate,
    onDownloadSelected,
    onSelectAll,
    onFileUpload,
    isGenerating,
    isGenerateDisabled,
    generationProgress,
    selectedCount,
    allSelected,
    totalStories
}) => {
    const generateButtonText = selectedCount > 0
        ? `Generate Selected Audio (${selectedCount})`
        : 'Generate All Audio';

    return (
        <div className="bg-gray-800 p-4 rounded-lg mb-8 flex flex-col sm:flex-row items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center space-x-4">
                <button
                    onClick={onGenerate}
                    disabled={isGenerating || isGenerateDisabled}
                    className="flex items-center justify-center px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    {isGenerating ? (
                        <>
                            <LoadingSpinner className="w-5 h-5 mr-2" />
                            <span>Generating... ({generationProgress.current}/{generationProgress.total})</span>
                        </>
                    ) : (
                        <span>{generateButtonText}</span>
                    )}
                </button>
                <label htmlFor="csv-upload" className="cursor-pointer px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 transition-colors">
                    Upload CSV
                </label>
                <input id="csv-upload" type="file" accept=".csv" className="hidden" onChange={onFileUpload} />
            </div>
            <div className="flex items-center space-x-4">
                <div className="flex items-center">
                    <input
                        id="select-all"
                        type="checkbox"
                        className="h-4 w-4 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500"
                        checked={allSelected}
                        onChange={(e) => onSelectAll(e.target.checked)}
                        disabled={totalStories === 0}
                    />
                    <label htmlFor="select-all" className="ml-2 text-sm font-medium text-gray-300">
                        {allSelected ? 'Deselect All' : 'Select All'}
                    </label>
                </div>
                <button
                    onClick={onDownloadSelected}
                    disabled={selectedCount === 0}
                    className="px-4 py-2 bg-teal-600 text-white font-semibold rounded-md hover:bg-teal-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                >
                    Download ZIP ({selectedCount})
                </button>
            </div>
        </div>
    );
};

export default GlobalControls;