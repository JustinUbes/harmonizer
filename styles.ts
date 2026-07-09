import { StyleSheet } from 'react-native';

export const harmonizerGreen = '#00ce0f';
export const harmonizerBlack = '#000000';

const styles = StyleSheet.create({
  appButtonContainer: {
    backgroundColor: harmonizerGreen,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },

  appButtonText: {
    fontSize: 18,
    color: 'black',
    fontWeight: 'bold',
    alignSelf: 'center',
    textTransform: 'uppercase',
    fontFamily: 'Main',
  },

  container: {
    flex: 1,
    justifyContent: 'space-evenly',
    flexDirection: 'column',
    alignItems: 'center',
    backgroundColor: 'black',
    padding: 10,
  },

  playbackContainer: {
    backgroundColor: harmonizerGreen,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#00a80c',
    padding: 12,
    marginVertical: 6,
  },

  playbackButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
  },

  recordedText: {
    color: '#000',
    fontFamily: 'Main',
    fontSize: 14,
    marginBottom: 4,
  },

  lengthText: {
    color: '#000',
    fontFamily: 'Main',
    fontSize: 13,
    minWidth: 36,
    textAlign: 'center',
  },

  turntable: {
    resizeMode: 'contain',
    width: 220,
    height: 220,
  },

  logoImage: {
    resizeMode: 'contain',
    width: 200,
    height: 200,
  },

  drawerContainer: {
    backgroundColor: 'black',
    justifyContent: 'flex-start',
    flexDirection: 'column',
    height: '100%',
  },

  drawerItem: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: harmonizerGreen,
  },

  drawerItemText: {
    fontSize: 20,
    fontFamily: 'Main',
    color: harmonizerGreen,
  },

  drawerHeader: {
    backgroundColor: 'black',
  },

  headerTitle: {
    color: harmonizerGreen,
    fontFamily: 'Main',
  },

  timerText: {
    color: harmonizerGreen,
    fontFamily: 'Main',
    fontSize: 56,
    letterSpacing: 4,
  },

  textInputText: {
    color: '#000',
    fontFamily: 'Main',
    fontSize: 18,
    height: 36,
    minWidth: 150,
    textAlign: 'center',
  },

  emptyStateText: {
    color: harmonizerGreen,
    fontFamily: 'Main',
    fontSize: 20,
    textAlign: 'center',
    lineHeight: 32,
  },

  harmonyLabel: {
    color: harmonizerGreen,
    fontFamily: 'Main',
    fontSize: 18,
    marginBottom: 8,
    letterSpacing: 1,
  },

  intervalContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },

  intervalButton: {
    borderWidth: 1,
    borderColor: harmonizerGreen,
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    margin: 4,
  },

  intervalButtonActive: {
    backgroundColor: harmonizerGreen,
  },

  intervalButtonText: {
    color: harmonizerGreen,
    fontFamily: 'Main',
    fontSize: 15,
  },

  intervalButtonTextActive: {
    color: 'black',
  },

  sectionTitle: {
    color: harmonizerGreen,
    fontFamily: 'Main',
    fontSize: 24,
    marginBottom: 10,
    letterSpacing: 2,
  },

  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '90%',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f1f',
  },

  settingsLabel: {
    color: harmonizerGreen,
    fontFamily: 'Main',
    fontSize: 18,
  },

  versionText: {
    color: '#444',
    fontFamily: 'Main',
    fontSize: 14,
    marginTop: 24,
  },
});

export default styles;
