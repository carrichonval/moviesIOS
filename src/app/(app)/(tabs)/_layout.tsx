import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';

// NativeTabs renders the actual native UITabBarController (via react-native-screens) instead of a
// JS-drawn tab bar — on iOS 26 with Xcode 26 that means the real system Liquid Glass tab bar,
// automatically, with no extra config. Older iOS falls back to the classic native tab bar style,
// Android to Material 3. This replaces the old expo-router `Tabs` + BlurView background, which only
// faked a blur — it can't reproduce iOS 26's real glass material. Labels are hidden (icon-only,
// like Instagram) to keep the bar compact.
export default function TabsLayout() {
  return (
    <NativeTabs tintColor="#409CFF" iconColor={{ default: '#8E8E93', selected: '#409CFF' }}>
      <NativeTabs.Trigger name="index">
        <Label hidden>Bibliothèque</Label>
        <Icon sf={{ default: 'popcorn', selected: 'popcorn.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="search" role="search">
        <Label hidden>Rechercher</Label>
        <Icon sf={{ default: 'magnifyingglass', selected: 'magnifyingglass' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="stats">
        <Label hidden>Stats</Label>
        <Icon sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Label hidden>Profil</Label>
        <Icon sf={{ default: 'person', selected: 'person.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
