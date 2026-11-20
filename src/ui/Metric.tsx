import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, type, space } from '../theme/tokens';
import Sparkline from './Sparkline';

type Props = { label: string; value: string; unit?: string; trend?: number[] };

export default function Metric({ label, value, unit, trend }: Props) {
  return (
    <View style={styles.box}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>
        {value}{unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </Text>
      {trend ? <Sparkline data={trend} /> : <View style={styles.line} />}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1 },
  label: { ...type.micro, color: colors.inkTertiary, marginBottom: space.sm },
  value: { ...type.metric, color: colors.ink },
  unit: { fontSize: 11, color: colors.inkSecondary, fontWeight: '400' },
  line: { height: 1, backgroundColor: colors.hairline, marginTop: space.md },
});
