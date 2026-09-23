package com.aldibiki.attune

/** JNI surface of libattune-engine.so (see app/src/main/cpp/attune-engine.cpp). */
object EngineNative {
    init { System.loadLibrary("attune-engine") }

    /**
     * Loads the fastest CPU backend this processor can run, from the app's
     * native library folder. Must run before the first nStart. Safe to repeat.
     */
    external fun nPreload(nativeLibDir: String)

    /** Active backends and CPU features (plain text, for the Engine screen). */
    external fun nSystemInfo(): String

    /** Starts llama.cpp's server on a background thread. False if already running. */
    external fun nStart(args: Array<String>): Boolean

    /** Stops a READY server and joins its thread. Blocking; never on the UI thread. */
    external fun nStop(timeoutMs: Int)

    /** 0 = stopped, 1 = running, 2 = exited on its own (see nExitCode). */
    external fun nState(): Int

    external fun nExitCode(): Int
}
