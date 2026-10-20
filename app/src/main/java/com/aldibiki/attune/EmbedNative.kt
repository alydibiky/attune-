package com.aldibiki.attune

/** v6.45 JNI surface of libattune-embed.so (app/src/main/cpp/attune-embed.cpp): the meaning model for Recall. */
object EmbedNative {
    init { System.loadLibrary("attune-embed") }

    /** Loads the model (once; true when ready). EngineNative.nPreload must have run (the CPU backend). */
    external fun nLoad(path: String, threads: Int): Boolean

    /** One text → its normalised vector (1024 numbers for bge-m3); empty on failure. */
    external fun nEmbed(text: String): FloatArray

    /** Frees the model and its memory. */
    external fun nFree()
}
