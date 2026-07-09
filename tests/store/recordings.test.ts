import recordingsReducer, {
  addRec,
  delRec,
  updateTitle,
  clearRec,
  Recording,
} from '../../store/redux/recordings';

const sampleRecording: Recording = {
  uri: 'file:///test/recording1.m4a',
  date: 'Jul 8, 2026, 2:00 PM',
  duration: 5000,
  title: '',
};

describe('recordings reducer', () => {
  it('returns the initial state', () => {
    const state = recordingsReducer(undefined, { type: '@@INIT' });
    expect(state.recordings).toEqual([]);
  });

  it('adds a recording', () => {
    const state = recordingsReducer(undefined, addRec(sampleRecording));
    expect(state.recordings).toHaveLength(1);
    expect(state.recordings[0].uri).toBe(sampleRecording.uri);
  });

  it('deletes a recording by uri', () => {
    const withOne = recordingsReducer(undefined, addRec(sampleRecording));
    const withNone = recordingsReducer(withOne, delRec({ uri: sampleRecording.uri }));
    expect(withNone.recordings).toHaveLength(0);
  });

  it('does not delete a recording with a non-matching uri', () => {
    const withOne = recordingsReducer(undefined, addRec(sampleRecording));
    const state = recordingsReducer(withOne, delRec({ uri: 'file:///other.m4a' }));
    expect(state.recordings).toHaveLength(1);
  });

  it('updates a recording title', () => {
    const withOne = recordingsReducer(undefined, addRec(sampleRecording));
    const updated = recordingsReducer(
      withOne,
      updateTitle({ uri: sampleRecording.uri, title: 'My Song' })
    );
    expect(updated.recordings[0].title).toBe('My Song');
  });

  it('clears all recordings', () => {
    const withTwo = [sampleRecording, { ...sampleRecording, uri: 'file:///test/rec2.m4a' }];
    const preloaded = { recordings: withTwo };
    const state = recordingsReducer(preloaded, clearRec());
    expect(state.recordings).toHaveLength(0);
  });
});
