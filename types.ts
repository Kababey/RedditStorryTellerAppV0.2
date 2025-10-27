export type NarratorGender = 'male' | 'female' | 'indeterminate';

export type StoryStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface Story {
  id: string;
  created_utc: string;
  subreddit: string;
  title: string;
  author: string;
  score: number;
  num_comments: number;
  url: string;
  permalink: string;
  is_self: boolean;
  selftext: string;
  over_18: boolean;
  rewritten_story: string;
  cover_text: string;
  label: string;
  // State properties
  narratorGender?: NarratorGender;
  audioData?: string; // base64 encoded raw PCM audio for rewritten_story
  coverAudioData?: string; // base64 encoded raw PCM audio for cover_text
  voiceName?: string; // The specific voice model used (e.g., 'Puck')
  status: StoryStatus;
  isSelected?: boolean;
  errorMessage?: string;
  audioFileName?: string;
  coverAudioFileName?: string;
}
