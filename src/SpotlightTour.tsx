import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';

// Spotlight tour: dims the screen, cuts a rounded hole around one element,
// and shows a speech-bubble card with Skip and Next.
//
// Auto start: the "done" flag is stored on the device (AsyncStorage) per tour id and user id.
// Uninstalling the app wipes it, so the tour shows again after reinstall and login.

const INK = '#141413';
const PAPER = '#FAF9F5';
const CLAY = '#D97757';
const SAGE = '#5E9473';
const MUTED = '#5E5D59';
const HOLE_PAD = 6;
type ViewHandle = React.ElementRef<typeof View>;

export interface TourStep {
  key: string; // must match the stepKey of a <TourTarget>
  title: string;
  body: string;
  hint?: string; // small line under the body, e.g. "Next takes you to Profile."
  /** Runs before the step is shown. Navigate to the right tab or scroll the target into view here. */
  onEnter?: () => void | Promise<void>;
}

interface Ctx {
  register: (key: string, node: ViewHandle | null) => void;
  start: () => void;
  stop: () => void;
}
const TourContext = createContext<Ctx | null>(null);
export const useTour = () => {
  const c = useContext(TourContext);
  return c || { register: () => {}, start: () => {}, stop: () => {} };
};

export function TourTarget({ stepKey, children, style }: { stepKey: string; children: React.ReactNode; style?: any }) {
  const { register } = useTour();
  const ref = useRef<ViewHandle>(null);
  useEffect(() => {
    register(stepKey, ref.current);
    return () => register(stepKey, null);
  }, [register, stepKey]);
  return (
    <View ref={ref} collapsable={false} style={style}>
      {children}
    </View>
  );
}

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export function TourProvider({
  tourId,
  userId,
  steps,
  autoStart = true,
  startDelayMs = 700,
  onFinish,
  children,
}: {
  tourId: string;
  userId: string; // so a second account on the same phone also sees the tour once
  steps: TourStep[];
  autoStart?: boolean;
  startDelayMs?: number;
  onFinish?: () => void;
  children: React.ReactNode;
}) {
  const storageKey = `securebox:tour:${tourId}:${userId}`;
  const targets = useRef<Record<string, ViewHandle | null>>({});
  const overlayRef = useRef<ViewHandle>(null);
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [cardH, setCardH] = useState(180);
  const [placed, setPlaced] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const placedRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const hx = useSharedValue(0);
  const hy = useSharedValue(0);
  const hw = useSharedValue(0);
  const hh = useSharedValue(0);
  const holeProps = useAnimatedProps(() => ({ x: hx.value, y: hy.value, width: hw.value, height: hh.value }));

  const register = useCallback((key: string, node: ViewHandle | null) => {
    targets.current[key] = node;
  }, []);

  const finish = useCallback(async () => {
    setActive(false);
    setPlaced(null);
    placedRef.current = null;
    try {
      await AsyncStorage.setItem(storageKey, 'done');
    } catch {}
    onFinish?.();
  }, [storageKey, onFinish]);

  const start = useCallback(() => {
    setIndex(0);
    setPlaced(null);
    placedRef.current = null;
    setActive(true);
  }, []);
  const stop = useCallback(() => {
    void finish();
  }, [finish]);

  // Auto start once per user per device.
  useEffect(() => {
    if (!autoStart) return;
    let timer: ReturnType<typeof setTimeout>;
    AsyncStorage.getItem(storageKey)
      .then((v) => {
        if (v !== 'done') timer = setTimeout(start, startDelayMs);
      })
      .catch(() => {});
    return () => clearTimeout(timer);
  }, [autoStart, storageKey, start, startDelayMs]);

  // Android back button skips the tour.
  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      void finish();
      return true;
    });
    return () => sub.remove();
  }, [active, finish]);

  // For each step: run onEnter (navigate or scroll), wait for the target to appear,
  // measure it relative to the overlay, then glide the hole to it.
  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    const measure = (o: ViewHandle, t: ViewHandle) =>
      new Promise<{ x: number; y: number; w: number; h: number }>((resolve) => {
        try {
          if (!o?.measureInWindow || !t?.measureInWindow) {
            return resolve({ x: 0, y: 0, w: 0, h: 0 });
          }
          o.measureInWindow((ox: number, oy: number) => {
            try {
              t.measureInWindow((x: number, y: number, w: number, h: number) => {
                resolve({
                  x: (x || 0) - (ox || 0) - HOLE_PAD,
                  y: (y || 0) - (oy || 0) - HOLE_PAD,
                  w: (w || 0) + HOLE_PAD * 2,
                  h: (h || 0) + HOLE_PAD * 2,
                });
              });
            } catch {
              resolve({ x: 0, y: 0, w: 0, h: 0 });
            }
          });
        } catch {
          resolve({ x: 0, y: 0, w: 0, h: 0 });
        }
      });
    const run = async () => {
      const st = steps[index];
      try {
        await st.onEnter?.();
      } catch {}
      for (let n = 0; n < 30 && !cancelled; n++) {
        await new Promise<void>((r) => setTimeout(r, n === 0 ? 150 : 100));
        const t = targets.current[st.key];
        const o = overlayRef.current;
        if (!t || !o) continue;
        const r = await measure(o, t);
        if (cancelled) return;
        if (r.w <= HOLE_PAD * 2 && r.h <= HOLE_PAD * 2) continue; // not laid out yet
        const first = placedRef.current === null;
        const cfg = { duration: 320, easing: Easing.out(Easing.cubic) };
        hx.value = first ? r.x : withTiming(r.x, cfg);
        hy.value = first ? r.y : withTiming(r.y, cfg);
        hw.value = first ? r.w : withTiming(r.w, cfg);
        hh.value = first ? r.h : withTiming(r.h, cfg);
        placedRef.current = r;
        setPlaced(r);
        return;
      }
      // The target never showed up (screen not mounted). Skip this step.
      if (!cancelled) {
        if (index >= steps.length - 1) {
          void finish();
        } else {
          setIndex(index + 1);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, index, size.w, size.h]);

  const ctx = useMemo(() => ({ register, start, stop }), [register, start, stop]);
  const step = steps[index];
  const last = index === steps.length - 1;
  const radius = placed ? Math.min(18, placed.h / 2) : 16;

  const below = placed ? placed.y + placed.h + 14 + cardH + 12 < size.h : true;
  const cardTop = placed ? (below ? placed.y + placed.h + 14 : Math.max(20, placed.y - cardH - 14)) : 0;
  const cardLeft = 20;
  const cardW = size.w - 40;
  const arrowX = placed ? Math.max(24, Math.min(placed.x + placed.w / 2 - cardLeft - 7, cardW - 38)) : 24;

  return (
    <TourContext.Provider value={ctx}>
      <View style={styles.flex}>
        {children}
        {active && (
          <View
            ref={overlayRef}
            style={StyleSheet.absoluteFill}
            onLayout={(e: LayoutChangeEvent) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
            onStartShouldSetResponder={() => true} // swallow touches meant for the screen underneath
          >
            {size.w > 0 && (
              <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill} pointerEvents="none">
                <Defs>
                  <Mask id="hole">
                    <Rect x={0} y={0} width={size.w} height={size.h} fill="white" />
                    <AnimatedRect animatedProps={holeProps} rx={radius} fill="black" />
                  </Mask>
                </Defs>
                <Rect x={0} y={0} width={size.w} height={size.h} fill="rgba(20,20,19,0.72)" mask="url(#hole)" />
                <AnimatedRect animatedProps={holeProps} rx={radius} fill="none" stroke={CLAY} strokeWidth={2.5} />
              </Svg>
            )}

            {placed && (
              <View
                onLayout={(e) => setCardH(e.nativeEvent.layout.height)}
                style={[styles.card, { top: cardTop, left: cardLeft, width: cardW }]}
              >
                <View style={[styles.arrow, below ? { top: -7 } : { bottom: -7 }, { left: arrowX }]} />
                <View style={styles.rowBetween}>
                  <Text style={styles.chip}>{`QUICK TOUR · ${index + 1} OF ${steps.length}`}</Text>
                  <View style={styles.dots}>
                    {steps.map((s, k) => (
                      <View key={s.key} style={[styles.dot, k === index && styles.dotOn]} />
                    ))}
                  </View>
                </View>
                <Text style={styles.title}>{step.title}</Text>
                <Text style={[styles.body, step.hint ? { marginBottom: 6 } : null]}>{step.body}</Text>
                {step.hint ? <Text style={styles.hint}>{step.hint}</Text> : null}
                <View style={styles.rowBetween}>
                  <Pressable accessibilityRole="button" onPress={finish} hitSlop={10}>
                    <Text style={styles.skip}>{last ? 'Close' : 'Skip'}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => (last ? finish() : setIndex(index + 1))}
                    style={({ pressed }) => [styles.next, last && { backgroundColor: SAGE }, pressed && { transform: [{ scale: 0.97 }] }]}
                  >
                    <Text style={styles.nextText}>{last ? 'Get started' : 'Next'}</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </TourContext.Provider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    position: 'absolute',
    backgroundColor: PAPER,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(20,20,19,0.18)',
    padding: 18,
  },
  arrow: {
    position: 'absolute',
    width: 14,
    height: 14,
    backgroundColor: PAPER,
    borderColor: 'rgba(20,20,19,0.18)',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    transform: [{ rotate: '45deg' }],
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#B5522F',
    backgroundColor: '#F7E6DE',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  dots: { flexDirection: 'row', gap: 4, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(20,20,19,0.18)' },
  dotOn: { width: 18, backgroundColor: CLAY },
  title: { fontSize: 18, fontWeight: '600', color: INK, marginTop: 12, marginBottom: 6 },
  body: { fontSize: 15, lineHeight: 22, color: MUTED, marginBottom: 16 },
  hint: { fontSize: 13, fontWeight: '600', color: '#B5522F', marginBottom: 12 },
  skip: { fontSize: 15, fontWeight: '600', color: MUTED },
  next: { backgroundColor: CLAY, borderRadius: 16, minHeight: 44, paddingHorizontal: 22, alignItems: 'center', justifyContent: 'center' },
  nextText: { fontSize: 15, fontWeight: '700', color: INK },
});
