import { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";
import type { AppTheme } from "../theme/webUi";

const SOURCES = {
  dark: require("../../assets/landing-dark.mp4"),
  light: require("../../assets/landing-white.mp4"),
} as const;

type LandingVideoProps = {
  theme: AppTheme;
  onDone: () => void;
};

export function LandingVideo({ theme, onDone }: LandingVideoProps) {
  const doneRef = useRef(false);
  const source = theme === "dark" ? SOURCES.dark : SOURCES.light;
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.play();
  });

  const done = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    const timeout = setTimeout(done, 5000);
    return () => clearTimeout(timeout);
  }, []);
  
  useEffect(() => {
    const endSub = player.addListener("playToEnd", () => {
      done();
    });
    const errSub = player.addListener("statusChange", ({ status }) => {
      if (status === "error") {
        done();
      }
    });

    return () => {
      endSub.remove();
      errSub.remove();
    };
  }, [player]);

  return (
    <View style={[styles.container, theme === "dark" ? styles.dark : styles.light]}>
      <View style={styles.videoBox}>
        <VideoView player={player} style={styles.video} contentFit="contain" nativeControls={false} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
  },
  dark: {
    backgroundColor: "#000000",
  },
  light: {
    backgroundColor: "#FFFFFF",
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  videoBox: {
    width: "120%",
    height: "120%",
  },
});
