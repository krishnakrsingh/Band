import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import Screen from '../../ui/Screen';
import { colors, type, space, stroke, radius } from '../../theme/tokens';
import { useProfile } from '../../core/profile';
import { loadSettings, saveSettings } from '../../core/persistence';

function persistProfile(profile: Parameters<typeof saveSettings>[0]['profile']) {
  loadSettings().then(s => saveSettings({ ...s, profile }));
}

function Stepper({ label, value, min, max, step, unit, onChange }: {
  label: string; value: number; min: number; max: number; step: number; unit: string;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable onPress={() => onChange(clamp(value - step))} style={styles.stepBtn}>
          <Text style={styles.stepText}>−</Text>
        </Pressable>
        <Text style={styles.value}>{value}<Text style={styles.unit}>{unit}</Text></Text>
        <Pressable onPress={() => onChange(clamp(value + step))} style={styles.stepBtn}>
          <Text style={styles.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const p = useProfile();
  return (
    <Screen eyebrow="PROFILE" scroll>
      <View style={styles.hero}>
        <Text style={styles.heroNum}>{p.maxHr()}</Text>
        <Text style={styles.heroLabel}>MAX HR · 220 − AGE</Text>
      </View>

      <View style={styles.group}>
        <Stepper label="AGE" value={p.age} min={10} max={90} step={1} unit=""
          onChange={age => { p.setProfile({ age }); persistProfile({ ...p, age }); }} />
        <Stepper label="HEIGHT" value={p.heightCm} min={120} max={220} step={1} unit="cm"
          onChange={heightCm => { p.setProfile({ heightCm }); persistProfile({ ...p, heightCm }); }} />
        <Stepper label="WEIGHT" value={p.weightKg} min={30} max={200} step={1} unit="kg"
          onChange={weightKg => { p.setProfile({ weightKg }); persistProfile({ ...p, weightKg }); }} />
        <Stepper label="RESTING HR" value={p.restingHr} min={30} max={100} step={1} unit="bpm"
          onChange={restingHr => { p.setProfile({ restingHr }); persistProfile({ ...p, restingHr }); }} />
        <Stepper label="STEP GOAL" value={p.dailyStepGoal} min={1000} max={30000} step={1000} unit=""
          onChange={dailyStepGoal => { p.setProfile({ dailyStepGoal }); persistProfile({ ...p, dailyStepGoal }); }} />
      </View>

      <View style={styles.group}>
        <View style={styles.row}>
          <Text style={styles.label}>SEX</Text>
          <View style={styles.sexRow}>
            {(['male', 'female', 'other'] as const).map(s => (
              <Pressable key={s} onPress={() => { p.setProfile({ sex: s }); persistProfile({ ...p, sex: s }); }}
                style={[styles.sexBtn, p.sex === s && styles.sexBtnActive]}>
                <Text style={[styles.sexText, p.sex === s && styles.sexTextActive]}>{s.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <Text style={styles.foot}>USED FOR HR ZONES, CALORIES & PERSONAL BASELINES</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: space.xl },
  heroNum: { ...type.display, color: colors.ink },
  heroLabel: { ...type.micro, color: colors.inkSecondary, marginTop: 8 },
  group: { borderTopWidth: stroke.hairline, borderTopColor: colors.hairline, marginTop: space.md },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16, borderBottomWidth: stroke.hairline, borderBottomColor: colors.fillSoft },
  label: { ...type.micro, color: colors.inkSecondary, width: 90 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, borderWidth: stroke.hairline,
    borderColor: colors.hairline, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 18, color: colors.ink, fontWeight: '300' },
  value: { ...type.metric, color: colors.ink, minWidth: 60, textAlign: 'center' },
  unit: { fontSize: 11, color: colors.inkSecondary, marginLeft: 2 },
  sexRow: { flexDirection: 'row', gap: 6 },
  sexBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill,
    borderWidth: stroke.hairline, borderColor: colors.hairline },
  sexBtnActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  sexText: { ...type.micro, color: colors.inkSecondary },
  sexTextActive: { color: colors.bg },
  foot: { ...type.micro, color: colors.inkTertiary, textAlign: 'center', marginTop: space.xl },
});
