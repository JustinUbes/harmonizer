import React from 'react';
import { Text, View, Image, TouchableOpacity } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerContentComponentProps,
} from '@react-navigation/drawer';
import { store, persistor } from './store/redux/store';
import { PersistGate } from 'redux-persist/integration/react';
import { Provider } from 'react-redux';
import { useFonts } from 'expo-font';
import RecordScreen from './screens/RecordScreen';
import PlaybackScreen from './screens/PlaybackScreen';
import Settings from './screens/Settings';
import styles from './styles';
import CustomDrawerToggle from './components/CustomDrawerToggle';

type DrawerParamList = {
  Record: undefined;
  Playback: undefined;
  Settings: undefined;
};

const Drawer = createDrawerNavigator<DrawerParamList>();

const DRAWER_SCREENS = ['Record', 'Playback', 'Settings'] as const;

function CustomDrawerContent(props: DrawerContentComponentProps) {
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContainer}>
      <View style={{ alignItems: 'center' }}>
        <Image source={require('./assets/logo.png')} style={styles.logoImage} />
      </View>
      {DRAWER_SCREENS.map((screen) => (
        <TouchableOpacity
          key={screen}
          style={styles.drawerItem}
          onPress={() => props.navigation.navigate(screen)}
          accessibilityRole="menuitem"
        >
          <Text style={styles.drawerItemText}>{screen}</Text>
        </TouchableOpacity>
      ))}
    </DrawerContentScrollView>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Main: require('./assets/fonts/VT323-Regular.ttf'),
  });

  if (!fontsLoaded) return null;

  return (
    <Provider store={store}>
      <PersistGate persistor={persistor} loading={<Text>Loading...</Text>}>
        <NavigationContainer>
          <Drawer.Navigator
            drawerContent={CustomDrawerContent}
            screenOptions={{
              headerStyle: styles.drawerHeader,
              headerTitleStyle: styles.headerTitle,
              headerLeft: () => <CustomDrawerToggle />,
            }}
          >
            <Drawer.Screen name="Record" component={RecordScreen} />
            <Drawer.Screen name="Playback" component={PlaybackScreen} />
            <Drawer.Screen name="Settings" component={Settings} />
          </Drawer.Navigator>
        </NavigationContainer>
      </PersistGate>
    </Provider>
  );
}

