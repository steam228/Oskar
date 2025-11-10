// Coding Train / Daniel Shiffman
// adapted w/ml5 poseNET example to interactive text representation

const { VerletPhysics2D, VerletParticle2D, VerletSpring2D } = toxi.physics2d;
const { GravityBehavior } = toxi.physics2d.behaviors;
const { Vec2D, Rect } = toxi.geom;

let physics;

let particles = [];
let eyes = [];

let springs = [];
let showSprings = false;

let video;
let poseNet;
let pose;
let skeleton;

let vw;
let vh;

function keyPressed() {
  if (key == " ") {
    showSprings = !showSprings;
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  physics = new VerletPhysics2D();

  let bounds = new Rect(0, 0, width, height);
  physics.setWorldBounds(bounds);

  particles.push(new Particle(width / 6, height / 4));
  particles.push(new Particle((5 * width) / 6, height / 4));
  particles.push(new Particle(width / 6, (3 * height) / 4));
  particles.push(new Particle((5 * width) / 6, (3 * height) / 4));

  eyes.push(new Particle(width / 6, height / 2));
  eyes.push(new Particle((2 * width) / 6, height / 2));
  eyes.push(new Particle((4 * width) / 6, height / 2));
  eyes.push(new Particle((5 * width) / 6, height / 2));
  //eyes.push(new Particle(1000, 400));

  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      if (i !== j) {
        let a = particles[i];
        let b = particles[j];
        // let b = particles[(i + 1) % particles.length];
        springs.push(new Spring(a, b, 0.001));
      }
    }
  }

  for (let particle of particles) {
    springs.push(new Spring(particle, eyes[0], 0.01));
    springs.push(new Spring(particle, eyes[1], 0.01));
    springs.push(new Spring(particle, eyes[2], 0.01));
    springs.push(new Spring(particle, eyes[3], 0.01));
    //springs.push(new Spring(particle, eyes[4], 0.01));
  }

  springs.push(new Spring(particles[0], particles[2], 0.01));
  springs.push(new Spring(particles[1], particles[3], 0.01));

  video = createCapture(VIDEO);
  vw = width;
  vh = width * (1080 / 1920);
  video.size(vw, vh);
  video.hide();
  poseNet = ml5.poseNet(video, modelLoaded);
  poseNet.on("pose", gotPoses);
}

function gotPoses(poses) {
  //console.log(poses);
  if (poses.length > 0) {
    pose = poses[0].pose;
  }
}

function modelLoaded() {
  console.log("poseNet ready");
}

function draw() {
  //background(255);
  image(video, 0, 0, vw, vh);
  if (!keyIsPressed) {
    noStroke();
    fill(0, 0, 0, 180);
    rect(0, 0, width, height);
  }
  if (pose) {
    // We can call both functions to draw all keypoints and the skeletons

    physics.update();

    noStroke();
    if (showSprings) stroke(51, 153, 103, 100);

    noFill();
    if (showSprings) fill(51, 153, 103, 100);
    strokeWeight(2);
    beginShape();
    for (let particle of particles) {
      vertex(particle.x, particle.y);
    }
    endShape(CLOSE);

    beginShape();
    stroke(51, 153, 103);
    strokeWeight(6);
    let x1 = eyes[0].x,
      x2 = eyes[1].x,
      x3 = eyes[2].x,
      x4 = eyes[3].x;
    //x5 = eyes[4].x;
    let y1 = eyes[0].y,
      y2 = eyes[1].y,
      y3 = eyes[2].y,
      y4 = eyes[3].y;
    //y5 = eyes[4].y;
    bezier(x1, y1, x2, y2, x3, y3, x4, y4);
    for (let i = 0; i <= 20; i++) {
      let steps = i / 20;
      let pointX = bezierPoint(x1, x2, x3, x4, steps);
      let pointY = bezierPoint(y1, y2, y3, y4, steps);
      fill(51, 153, 103);
      noStroke();
      circle(pointX, pointY, 20);
    }

    endShape(CLOSE);

    if (showSprings) {
      for (let spring of springs) {
        spring.show();
      }
    }

    eyes[0].lock();
    eyes[0].x = pose.leftWrist.x;
    eyes[0].y = pose.leftWrist.y;
    eyes[0].unlock();
    eyes[3].lock();
    eyes[3].x = pose.rightWrist.x;
    eyes[3].y = pose.rightWrist.y;
    eyes[3].unlock();
  }
}
