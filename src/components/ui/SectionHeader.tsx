import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';

interface SectionHeaderProps {
  title: string;
  onPressSeeAll?: () => void;
}

export function SectionHeader({ title, onPressSeeAll }: SectionHeaderProps) {
  return (
    <View className="mb-3 flex-row items-center justify-between px-5">
      <Text className="text-[22px] font-bold text-content-primary">{title}</Text>
      {onPressSeeAll ? (
        <Pressable
          onPress={onPressSeeAll}
          hitSlop={8}
          className="flex-row items-center active:opacity-60"
        >
          <Text className="text-[15px] font-medium text-accent-light">Voir tout</Text>
          <ChevronRight size={18} color="#409CFF" />
        </Pressable>
      ) : null}
    </View>
  );
}
