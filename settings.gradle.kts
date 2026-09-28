pluginManagement {
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}
dependencyResolutionManagement {
    // Huawei's repository: only for Health Kit (Huawei Health / Huawei watches), v6.5
    repositories { google(); mavenCentral(); maven("https://developer.huawei.com/repo/") }
}
rootProject.name = "Attune"
include(":app")
