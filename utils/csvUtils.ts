import { Story } from '../types';

function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function exportStoryToTxt(story: Story) {
    const textContent = `Title: ${story.title}\n\nCover Text:\n${story.cover_text}\n\n---\n\nFull Story:\n${story.rewritten_story}`;
    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8;' });
    const filename = `${story.id}_transcript.txt`;
    triggerDownload(blob, filename);
}