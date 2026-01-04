# iOS Game

A simple SpriteKit-based iOS game built with Swift.

## Overview

This is a basic iOS game that demonstrates SpriteKit physics and touch interaction. The game features a player character that jumps when you tap the screen, and you can create colorful falling objects by tapping anywhere on the screen.

## Features

- SpriteKit-based game engine
- Physics simulation with gravity and collision detection
- Touch interaction - tap to create falling objects
- Score tracking
- Colorful random objects
- Player jump mechanics

## Requirements

- Xcode 12.0 or later
- iOS 13.0 or later
- Swift 5.0

## Getting Started

### Opening the Project

1. Navigate to the `iOSGame` directory
2. Open `iOSGame.xcodeproj` in Xcode
3. Select a simulator or connect an iOS device
4. Press `Cmd + R` to build and run

### Project Structure

```
iOSGame/
├── iOSGame.xcodeproj/       # Xcode project file
│   └── project.pbxproj      # Project configuration
└── iOSGame/                 # Main app directory
    ├── AppDelegate.swift    # App entry point
    ├── GameViewController.swift  # Main view controller
    ├── Scenes/
    │   └── GameScene.swift  # Game scene with physics and logic
    ├── Assets.xcassets/     # App icons and image assets
    ├── Base.lproj/
    │   ├── Main.storyboard  # Main UI storyboard
    │   └── LaunchScreen.storyboard  # Launch screen
    └── Info.plist           # App configuration
```

## How to Play

1. Launch the app
2. Tap anywhere on the screen to create falling objects
3. Watch as objects fall with realistic physics
4. The player (cyan square) will jump with each tap
5. Your score increases with each tap

## Customization

### Changing Game Physics

Edit the gravity vector in `GameScene.swift:40`:

```swift
physicsWorld.gravity = CGVector(dx: 0, dy: -2)
```

### Modifying Object Appearance

Change object size in `GameScene.swift:49`:

```swift
let fallingObject = SKSpriteNode(color: .random(), size: CGSize(width: 30, height: 30))
```

### Adjusting Player Jump

Modify the jump impulse in `GameScene.swift:60`:

```swift
player?.physicsBody?.applyImpulse(CGVector(dx: 0, dy: 30))
```

## Building for Distribution

1. Set your development team in Xcode project settings
2. Update the bundle identifier in `project.pbxproj` or Xcode
3. Archive the project: `Product > Archive`
4. Upload to App Store Connect or export for ad-hoc distribution

## Next Steps

Some ideas for extending this game:

- Add enemy objects that decrease your score
- Implement power-ups
- Add sound effects and background music
- Create multiple levels
- Add game over conditions
- Implement high score persistence
- Add particle effects
- Create custom sprites and animations

## License

This project is provided as-is for educational purposes.

## Support

For issues or questions, please refer to the Apple Developer documentation:
- [SpriteKit Documentation](https://developer.apple.com/documentation/spritekit)
- [Swift Documentation](https://developer.apple.com/documentation/swift)
