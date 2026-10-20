export type NoteStatus = 'Todo' | 'In-Progress' | 'On-Hold' | 'Done';

/** Wire format for a note. `updatedAt` is epoch milliseconds so the UI's
 *  formatRelativeTime(ts: number) helper keeps working unchanged. */
export type NoteDTO = {
  id: string;
  title: string;
  status: NoteStatus;
  content: string;
  isPinned: boolean;
  sortOrder: number;
  updatedAt: number;
};

export type PublicUser = {
  id: string;
  email: string;
  name: string;
};
