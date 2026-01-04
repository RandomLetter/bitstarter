import SpriteKit

class GameScene: SKScene {

    private var player: SKSpriteNode?
    private var score: Int = 0
    private var scoreLabel: SKLabelNode?

    override func didMove(to view: SKView) {
        // Set up the scene
        backgroundColor = SKColor.black

        // Create score label
        scoreLabel = SKLabelNode(fontNamed: "AvenirNext-Bold")
        scoreLabel?.text = "Score: 0"
        scoreLabel?.fontSize = 24
        scoreLabel?.fontColor = SKColor.white
        scoreLabel?.position = CGPoint(x: frame.midX, y: frame.maxY - 50)
        addChild(scoreLabel!)

        // Create player
        player = SKSpriteNode(color: .cyan, size: CGSize(width: 50, height: 50))
        player?.position = CGPoint(x: frame.midX, y: frame.midY)
        addChild(player!)

        // Add instructions
        let instructionLabel = SKLabelNode(fontNamed: "AvenirNext-Regular")
        instructionLabel.text = "Tap to start the game!"
        instructionLabel.fontSize = 20
        instructionLabel.fontColor = SKColor.white
        instructionLabel.position = CGPoint(x: frame.midX, y: frame.midY - 100)
        addChild(instructionLabel)

        // Set up physics
        physicsWorld.gravity = CGVector(dx: 0, dy: -2)
        physicsBody = SKPhysicsBody(edgeLoopFrom: frame)
    }

    override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
        for touch in touches {
            let location = touch.location(in: self)

            // Add a falling object at the touch location
            let fallingObject = SKSpriteNode(color: .random(), size: CGSize(width: 30, height: 30))
            fallingObject.position = CGPoint(x: location.x, y: frame.maxY)
            fallingObject.physicsBody = SKPhysicsBody(rectangleOf: fallingObject.size)
            fallingObject.physicsBody?.restitution = 0.7
            addChild(fallingObject)

            // Update score
            score += 1
            scoreLabel?.text = "Score: \(score)"
        }

        // Make player jump
        player?.physicsBody?.velocity = CGVector(dx: 0, dy: 0)
        player?.physicsBody?.applyImpulse(CGVector(dx: 0, dy: 30))
    }

    override func update(_ currentTime: TimeInterval) {
        // Game logic can be added here
    }
}

extension SKColor {
    static func random() -> SKColor {
        return SKColor(red: CGFloat.random(in: 0...1),
                      green: CGFloat.random(in: 0...1),
                      blue: CGFloat.random(in: 0...1),
                      alpha: 1.0)
    }
}
