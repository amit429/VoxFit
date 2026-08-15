# ProGuard/R8 rules for the VoxFit release build.
#
# `minifyEnabled true` was turned on in build.gradle to shrink and obfuscate the
# native layer. Capacitor resolves plugins REFLECTIVELY — by annotation and by
# JS-facing method name — so R8 cannot see those call sites and will happily
# strip or rename the very classes the bridge needs at runtime. Everything below
# exists to prevent that. Removing these rules produces an APK that builds fine
# and then fails at runtime with "Plugin not implemented", which is exactly the
# kind of breakage that only shows up on a device.
#
# VERIFY ON A REAL DEVICE after changing anything here:
#   npm run android:prepare:prod && cd android && ./gradlew assembleRelease
# then install the release APK and exercise voice capture (SpeechRecognition),
# haptics, keyboard, status bar and the voxfit:// deep link.

# ---- Capacitor core + bridge ----
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep @com.getcapacitor.NativePlugin class * { *; }

# Plugin methods are invoked by name from JS via the bridge.
-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod <methods>;
    public *;
}

# ---- Anything exposed to the WebView's JS context ----
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ---- Cordova plugins bridged through Capacitor ----
-keep class org.apache.cordova.** { *; }

# ---- Third-party plugins used by this app ----
# Speech recognition is the core feature; its plugin class is resolved by name.
-keep class com.getcapacitor.community.speechrecognition.** { *; }

# ---- Annotations / reflection metadata R8 would otherwise drop ----
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# ---- Crash-report readability ----
# Keep line numbers so release stack traces stay diagnosable, but rename the
# source file so the original paths aren't disclosed in them.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ---- Strip logging from release binaries ----
# Removes Log.d/v/i calls (and their string arguments) from the shipped APK, so
# anything a developer logged during debugging can't leak from a user's device.
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}
