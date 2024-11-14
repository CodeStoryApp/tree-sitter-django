// swift-tools-version:5.3
import PackageDescription

let package = Package(
    name: "TreeSitterDjango",
    products: [
        .library(name: "TreeSitterDjango", targets: ["TreeSitterDjango"]),
    ],
    dependencies: [
        .package(url: "https://github.com/ChimeHQ/SwiftTreeSitter", from: "0.8.0"),
    ],
    targets: [
        .target(
            name: "TreeSitterDjango",
            dependencies: [],
            path: ".",
            sources: [
                "src/parser.c",
                // NOTE: if your language has an external scanner, add it here.
            ],
            resources: [
                .copy("queries")
            ],
            publicHeadersPath: "bindings/swift",
            cSettings: [.headerSearchPath("src")]
        ),
        .testTarget(
            name: "TreeSitterDjangoTests",
            dependencies: [
                "SwiftTreeSitter",
                "TreeSitterDjango",
            ],
            path: "bindings/swift/TreeSitterDjangoTests"
        )
    ],
    cLanguageStandard: .c11
)
