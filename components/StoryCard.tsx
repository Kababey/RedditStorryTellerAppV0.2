import React from 'react';
import { Story } from '../types';
import { PlayIcon, PauseIcon, LoadingSpinner, ErrorIcon, CheckCircleIcon, DownloadIcon, DocumentTextIcon } from './Icons';
import { VOICES } from '../constants';

interface StoryCardProps {
  story: Story;
  isPlaying: boolean;
  onPlayPause: (storyId: string) => void;
  onSelect: (storyId: string, isSelected: boolean) => void;
  onDownloadAudio: (storyId: string, type: 'story' | 'cover') => void;
  onDownloadTranscript: (storyId: string) => void;
  onVoiceChange: (storyId: string, newVoice: string) => void;
}

const getLabelStyle = (label: string) => {
    switch (label) {
        case 'reels':
            return 'bg-purple-600';
        case 'long_4part':
            return 'bg-green-600';
        case 'long_6part':
            return 'bg-blue-600';
        default:
            return 'bg-gray-600';
    }
};

const StoryCard: React.FC<StoryCardProps> = ({ 
    story, 
    isPlaying, 
    onPlayPause, 
    onSelect, 
    onDownloadAudio, 
    onDownloadTranscript,
    onVoiceChange
}) => {
  const handlePlayPause = () => {
    onPlayPause(story.id);
  };
  
  const narratorGender = story.narratorGender;
  const genderColor = narratorGender === 'female' ? 'bg-pink-500' : narratorGender === 'male' ? 'bg-blue-500' : 'bg-gray-500';
  const labelColor = getLabelStyle(story.label);

  const getStatusIndicator = () => {
    switch (story.status) {
      case 'loading':
        return <LoadingSpinner className="w-5 h-5 text-cyan-400" />;
      case 'ready':
        return <CheckCircleIcon className="w-5 h-5 text-green-400" />;
      case 'error':
        return <ErrorIcon className="w-5 h-5 text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <div className={`bg-gray-800 rounded-lg overflow-hidden shadow-lg transform transition-all duration-300 hover:shadow-2xl flex flex-col border ${story.isSelected ? 'border-cyan-500' : 'border-gray-700'}`}>
      <div className="p-6 flex-grow flex flex-col">
        <div className="flex justify-between items-start mb-2">
            <h3 className="text-xl font-bold text-cyan-400 line-clamp-2 pr-4 flex-1">{story.title}</h3>
            <input 
                type="checkbox"
                className="form-checkbox h-5 w-5 text-cyan-600 bg-gray-700 border-gray-600 rounded focus:ring-cyan-500 shrink-0"
                checked={!!story.isSelected}
                onChange={(e) => onSelect(story.id, e.target.checked)}
                aria-label={`Select story: ${story.title}`}
            />
        </div>
        <p className="text-gray-400 text-sm mb-4 line-clamp-3 flex-grow">{story.cover_text}</p>
        
        {story.narratorGender && story.narratorGender !== 'indeterminate' && (
            <div className="mt-auto">
                 <label htmlFor={`voice-select-${story.id}`} className="block mb-1 text-xs font-medium text-gray-400">Narrator Voice</label>
                 <select
                    id={`voice-select-${story.id}`}
                    value={story.voiceName || ''}
                    onChange={(e) => onVoiceChange(story.id, e.target.value)}
                    disabled={story.status === 'loading'}
                    className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block w-full p-1.5"
                    aria-label="Select narrator voice"
                >
                    <option value="" disabled>Select a voice</option>
                    {VOICES[story.narratorGender].map(voice => (
                        <option key={voice} value={voice}>{voice}</option>
                    ))}
                </select>
            </div>
        )}
        {story.status === 'error' && <p className="text-xs text-red-400 mt-2">{story.errorMessage}</p>}
      </div>
      <div className="p-4 bg-gray-700/50 flex items-center justify-between">
        <div className="flex items-center space-x-3">
           <button
            onClick={handlePlayPause}
            className={`flex items-center justify-center w-12 h-12 rounded-full transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${
              isPlaying ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-cyan-500 hover:bg-cyan-600'
            } disabled:bg-gray-600 disabled:cursor-not-allowed`}
            disabled={story.status === 'loading' || !story.rewritten_story}
            aria-label={isPlaying ? 'Pause story' : 'Play story'}
          >
            {story.status === 'loading' ? (
              <LoadingSpinner className="w-6 h-6" />
            ) : isPlaying ? (
              <PauseIcon className="w-6 h-6" />
            ) : (
              <PlayIcon className="w-6 h-6 ml-1" />
            )}
          </button>
          <div className="flex flex-col space-y-1">
             {narratorGender && (
              <span className={`px-2 py-0.5 text-xs font-semibold text-white rounded-full ${genderColor} text-center`}>
                {narratorGender.charAt(0).toUpperCase() + narratorGender.slice(1)}
              </span>
            )}
            {story.label && (
                <span className={`px-2 py-0.5 text-xs font-semibold text-white rounded-full ${labelColor} text-center`}>
                    {story.label}
                </span>
            )}
            <div className="h-5">{getStatusIndicator()}</div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
            {story.status === 'ready' && (
                <>
                    <button onClick={() => onDownloadTranscript(story.id)} title="Download Transcript (.txt)" className="p-2 rounded-full hover:bg-gray-600 transition-colors">
                        <DocumentTextIcon />
                    </button>
                    <button onClick={() => onDownloadAudio(story.id, 'cover')} title="Download Cover Audio (.wav)" className="p-2 rounded-full hover:bg-gray-600 transition-colors">
                        <DownloadIcon className="w-5 h-5 text-pink-400"/>
                    </button>
                    <button onClick={() => onDownloadAudio(story.id, 'story')} title="Download Story Audio (.wav)" className="p-2 rounded-full hover:bg-gray-600 transition-colors">
                        <DownloadIcon className="w-5 h-5 text-cyan-400"/>
                    </button>
                </>
            )}
            <div className="text-right">
               <p className="text-xs text-gray-500">r/{story.subreddit}</p>
               <p className="text-xs text-gray-400">by {story.author}</p>
            </div>
        </div>
      </div>
    </div>
  );
};

export default StoryCard;