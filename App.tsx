import React, { useState, useRef, useEffect, useCallback } from 'react';
import StoryCard from './components/StoryCard';
import { Story } from './types';
import { determineNarratorGender, generateSpeech, decode, decodeAudioData } from './services/geminiService';
import { AUDIO_SAMPLE_RATE, initialCsvData } from './constants';
import { ErrorIcon, LoadingSpinner } from './components/Icons';
import { pcmToWav } from './utils/audioUtils';
import { exportStoryToTxt } from './utils/csvUtils';
import GlobalControls from './components/GlobalControls';
import { parseCSV } from './utils/csvParser';
import JSZip from 'jszip';


const App: React.FC = () => {
  const [stories, setStories] = useState<Story[]>([]);
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    // Initial data load
    try {
        const parsedStories = parseCSV(initialCsvData);
        setStories(parsedStories);
    } catch (e) {
        console.error("Error parsing initial CSV data:", e);
        setGlobalError("Failed to load initial story data.");
    }
  }, []);
  
  useEffect(() => {
    if (!audioContextRef.current) {
        try {
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
                sampleRate: AUDIO_SAMPLE_RATE,
            });
        } catch (e) {
            console.error("Web Audio API is not supported in this browser.", e);
            setGlobalError("Your browser does not support the audio playback required for this app.");
        }
    }

    return () => {
        audioContextRef.current?.close();
    }
  }, []);

  const stopCurrentAudio = useCallback(() => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
        audioSourceRef.current.disconnect();
      } catch (e) { console.warn("Could not stop audio source:", e); }
      audioSourceRef.current = null;
    }
    setCurrentlyPlayingId(null);
  }, []);

  const playAudio = useCallback(async (audioData: string, storyId: string) => {
    if (!audioContextRef.current) {
        setGlobalError("Audio context not initialized.");
        return;
    }
    
    stopCurrentAudio();
    
    try {
        const audioBuffer = await decodeAudioData(decode(audioData), audioContextRef.current);
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => {
            if (currentlyPlayingId === storyId) {
              setCurrentlyPlayingId(null);
            }
        };
        source.start(0);
        audioSourceRef.current = source;
        setCurrentlyPlayingId(storyId);
    } catch (error) {
        console.error('Error playing audio:', error);
        setGlobalError("Failed to decode or play audio.");
        setCurrentlyPlayingId(null);
    }
  }, [stopCurrentAudio, currentlyPlayingId]);

  const generateAudioForStory = async (storyId: string, voiceOverride?: string): Promise<boolean> => {
    const storyToProcess = stories.find(s => s.id === storyId);
    if (!storyToProcess) return false;

    setStories(prev => prev.map(s => s.id === storyId ? { ...s, status: 'loading', errorMessage: undefined } : s));

    try {
        const gender = storyToProcess.narratorGender || await determineNarratorGender(storyToProcess.rewritten_story);
        if (!storyToProcess.rewritten_story && !storyToProcess.cover_text) {
          throw new Error("Story has no content to generate audio from.");
        }
        
        const { audioData: storyAudio, voiceName } = await generateSpeech(storyToProcess.rewritten_story, gender, voiceOverride || storyToProcess.voiceName);
        const { audioData: coverAudio } = await generateSpeech(storyToProcess.cover_text, gender, voiceName);

        if (storyAudio !== null && coverAudio !== null) {
            setStories(prev => prev.map(s => s.id === storyId ? { 
                ...s, 
                audioData: storyAudio,
                coverAudioData: coverAudio,
                narratorGender: gender, 
                voiceName: voiceName,
                status: 'ready' 
            } : s));
            return true;
        } else {
            throw new Error("Speech generation failed for story or cover text.");
        }
    } catch (err: any) {
        console.error(`Failed to generate audio for ${storyId}:`, err);
        const errorMessage = err.message || "An unknown error occurred.";
        setStories(prev => prev.map(s => s.id === storyId ? { ...s, status: 'error', errorMessage } : s));
        return false;
    }
  };

  const handlePlayPause = useCallback(async (storyId: string) => {
    if (!audioContextRef.current) {
        setGlobalError("Audio cannot be played. Please refresh and try again.");
        return;
    }
    if (audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
    }

    if (currentlyPlayingId === storyId) {
      stopCurrentAudio();
      return;
    }

    const storyToPlay = stories.find(s => s.id === storyId);
    if (!storyToPlay) return;

    if (storyToPlay.audioData) {
      await playAudio(storyToPlay.audioData, storyId);
      return;
    }

    const success = await generateAudioForStory(storyId);
    if (success) {
      setTimeout(() => {
          setStories(currentStories => {
              const updatedStory = currentStories.find(s => s.id === storyId);
              if(updatedStory?.audioData) {
                  playAudio(updatedStory.audioData, storyId);
              }
              return currentStories;
          })
      }, 100);
    }
  }, [stories, currentlyPlayingId, playAudio, stopCurrentAudio]);

  const handleGenerate = async () => {
    setIsGeneratingAll(true);
    stopCurrentAudio();
    
    const selectedStories = stories.filter(s => s.isSelected);
    
    const storiesToGenerate = selectedStories.length > 0
      ? selectedStories.filter(s => s.status === 'idle' || s.status === 'error')
      : stories.filter(s => s.status === 'idle' || s.status === 'error');

    setGenerationProgress({ current: 0, total: storiesToGenerate.length });

    for (let i = 0; i < storiesToGenerate.length; i++) {
        const story = storiesToGenerate[i];
        await generateAudioForStory(story.id);
        setGenerationProgress(prev => ({ ...prev, current: i + 1 }));
    }
    setIsGeneratingAll(false);
  };
  
  const handleVoiceChange = async (storyId: string, newVoiceName: string) => {
    stopCurrentAudio();
    setStories(prev => prev.map(s => s.id === storyId ? { ...s, voiceName: newVoiceName } : s));
    await generateAudioForStory(storyId, newVoiceName);
  };

  const handleSelectStory = (storyId: string, isSelected: boolean) => {
    setStories(prev => prev.map(s => s.id === storyId ? { ...s, isSelected } : s));
  };
  
  const handleSelectAll = (isSelected: boolean) => {
    setStories(prev => prev.map(s => ({ ...s, isSelected })));
  };

  const handleDownloadAudio = (storyId: string, type: 'story' | 'cover') => {
    const story = stories.find(s => s.id === storyId);
    if (!story) return;

    const audioData = type === 'story' ? story.audioData : story.coverAudioData;
    const fileName = type === 'story' ? story.audioFileName : story.coverAudioFileName;

    if (!audioData) return;
    
    const pcmData = decode(audioData);
    const wavBlob = pcmToWav(pcmData, AUDIO_SAMPLE_RATE);
    const url = URL.createObjectURL(wavBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName || `${story.id}_${type}.wav`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleDownloadTranscript = (storyId: string) => {
    const story = stories.find(s => s.id === storyId);
    if(story) exportStoryToTxt(story);
  }

  const handleDownloadSelected = async () => {
      const selectedStories = stories.filter(s => s.isSelected && s.status === 'ready');
      if (selectedStories.length === 0) {
          setGlobalError("No stories with generated audio are selected for download.");
          setTimeout(() => setGlobalError(null), 5000);
          return;
      }

      const zip = new JSZip();

      for (const story of selectedStories) {
          const folder = zip.folder(story.id);
          if (!folder) continue;

          if (story.audioData) {
              const pcmData = decode(story.audioData);
              const wavBlob = pcmToWav(pcmData, AUDIO_SAMPLE_RATE);
              folder.file(story.audioFileName || `${story.id}_story.wav`, wavBlob);
          }

          if (story.coverAudioData) {
              const pcmData = decode(story.coverAudioData);
              const wavBlob = pcmToWav(pcmData, AUDIO_SAMPLE_RATE);
              folder.file(story.coverAudioFileName || `${story.id}_cover.wav`, wavBlob);
          }

          const textContent = `Title: ${story.title}\n\nCover Text:\n${story.cover_text}\n\n---\n\nFull Story:\n${story.rewritten_story}`;
          folder.file(`${story.id}_transcript.txt`, textContent);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      const a = document.createElement('a');
      const url = URL.createObjectURL(zipBlob);
      a.href = url;
      a.download = 'stories_export.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      stopCurrentAudio();
      setStories([]);
      setGlobalError(null);
      const text = await file.text();
      try {
        const newStories = parseCSV(text);
        if (newStories.length === 0) {
          setGlobalError("Uploaded CSV file is empty or could not be parsed. Please check the format.");
        }
        setStories(newStories);
      } catch (e) {
        console.error("Error parsing CSV:", e);
        setGlobalError("Failed to parse the uploaded CSV file. Make sure it follows the correct format.");
      }
      // Reset the file input so the same file can be uploaded again
      event.target.value = '';
    }
  };

  const selectedCount = stories.filter(s => s.isSelected).length;
  const allSelected = stories.length > 0 && selectedCount === stories.length;
  
  const generatableSelectedCount = stories.filter(s => s.isSelected && (s.status === 'idle' || s.status === 'error')).length;
  const generatableAllCount = stories.filter(s => s.status === 'idle' || s.status === 'error').length;
  const isGenerateDisabled = selectedCount > 0 ? generatableSelectedCount === 0 : generatableAllCount === 0;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
      <header className="bg-gray-800/50 backdrop-blur-sm sticky top-0 z-10 shadow-lg">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-center text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-teal-500">
            AI Storyteller
          </h1>
          <p className="text-center text-gray-400 mt-1">Bringing stories to life with generative voice AI</p>
        </div>
      </header>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <GlobalControls
            onGenerate={handleGenerate}
            onDownloadSelected={handleDownloadSelected}
            onSelectAll={handleSelectAll}
            onFileUpload={handleFileUpload}
            isGenerating={isGeneratingAll}
            isGenerateDisabled={isGenerateDisabled}
            generationProgress={generationProgress}
            selectedCount={selectedCount}
            allSelected={allSelected}
            totalStories={stories.length}
        />
        {globalError && (
             <div className="bg-red-900/50 border border-red-700 text-red-300 px-4 py-3 rounded-lg relative mb-6 flex items-center" role="alert">
                <ErrorIcon className="w-5 h-5 mr-3"/>
                <span className="block sm:inline">{globalError}</span>
             </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {stories.map(story => (
            <StoryCard
              key={story.id}
              story={story}
              isPlaying={currentlyPlayingId === story.id}
              onPlayPause={handlePlayPause}
              onSelect={handleSelectStory}
              onDownloadAudio={handleDownloadAudio}
              onDownloadTranscript={handleDownloadTranscript}
              onVoiceChange={handleVoiceChange}
            />
          ))}
        </div>
        {stories.length === 0 && !globalError && (
            <div className="text-center py-20">
                <LoadingSpinner className="w-12 h-12 mx-auto text-cyan-500" />
                <p className="mt-4 text-gray-400">Loading initial stories...</p>
            </div>
        )}
      </main>
      
      <footer className="text-center py-6 text-gray-600 text-sm">
        <p>Powered by Google Gemini API & React</p>
      </footer>
    </div>
  );
};

export default App;