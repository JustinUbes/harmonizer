import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Recording {
  uri: string;
  date: string;
  duration: number;
  title: string;
}

interface RecordingsState {
  recordings: Recording[];
}

const initialState: RecordingsState = {
  recordings: [],
};

const recSlice = createSlice({
  name: 'recordings',
  initialState,
  reducers: {
    addRec: (state, action: PayloadAction<Recording>) => {
      state.recordings.push(action.payload);
    },
    delRec: (state, action: PayloadAction<{ uri: string }>) => {
      state.recordings = state.recordings.filter(
        (recording) => recording.uri !== action.payload.uri
      );
    },
    updateTitle: (state, action: PayloadAction<{ uri: string; title: string }>) => {
      const recording = state.recordings.find((r) => r.uri === action.payload.uri);
      if (recording) {
        recording.title = action.payload.title;
      }
    },
    clearRec: (state) => {
      state.recordings = [];
    },
  },
});

export const { addRec, delRec, updateTitle, clearRec } = recSlice.actions;
export default recSlice.reducer;