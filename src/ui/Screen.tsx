import React from 'react';
import { StyleSheet, View, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, type, space } from '../theme/tokens';

type Props = {
  eyebrow: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  scroll?: boolean;
};

export default function Screen({ eyebrow, right, children, scroll = false }: Props) {
  const Body = scroll ? ScrollView : View;
  return (
    <SafeAreaView style={styles.root}>
      <Body style={styles.body} contentContainerStyle={scroll ? styles.scrollContent : undefined}>
        <View style={styles.head}>
          <Text style={styles.eyebrow}>{eyebrow}</Text>
          {right}
        </View>
        {children}
      </Body>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1, paddingHorizontal: space.lg },
  scrollContent: { paddingBottom: space.xxl },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: space.md, marginBottom: space.lg, minHeight: 32,
  },
  eyebrow: { ...type.caption, color: colors.inkSecondary },
});
