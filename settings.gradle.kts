pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    // Huawei's repository: only for Health Kit (Huawei Health / Huawei watches), v6.5
    repositories { google(); mavenCentral(); maven("https://developer.huawei.com/repo/") }
}
rootProject.name = "Attune"
include(":app")
include(":pypack")   // v8.7 (P7): Python for Code as a Play on-demand asset pack (the Play build only)
