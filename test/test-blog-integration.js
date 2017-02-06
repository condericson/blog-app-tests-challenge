const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

const should = chai.should();
const {TEST_DATABASE_URL} = require('../config');
const {BlogPost} = require('../models');
const {app, runServer, closeServer} = require('../server');


chai.use(chaiHttp);

function seedBlogData() {
	console.info('seeding blog post data');
	const seedData =[];

	for (let i=1; i<=10; i++) {
		seedData.push(generateBlogData());
	}
	return BlogPost.insertMany(seedData);
}


function generateBlogTitle() {
	const titles = [
		'Fizz', 'Bang', 'Foo', 'Bar', 'Fizzbang', 'Yolo', 'I enjoy long walks on the beach'];
	return titles[Math.floor(Math.random() * titles.length)];
}

function generateAuthor() {
	return {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName()
      }

}

function generateContent() {
	return faker.lorem.text(5);
}

function generateBlogData() {
	return {
		title: generateBlogTitle(),
		author: generateAuthor(),
		content: generateContent(),
		created: faker.date.past()
	}
}

function tearDownDB() {
	console.warn('Deleting database');
	return mongoose.connection.dropDatabase();
}

describe('Blog API resource', function() {
	before (function() {
		return runServer(TEST_DATABASE_URL);
	});
	beforeEach(function() {
		return seedBlogData();
	});
	afterEach(function() {
		return tearDownDB();
	});
	after(function() {
		return closeServer();
	});


	describe('GET endpoint', function() {
		it('should return all existing blog posts', function() {
			let res;
			return chai.request(app)
				.get('/posts')
				.then(function(_res) {
					//why does this function have a underscore in front of the variable?
					res = _res;
					res.should.have.status(200);
					res.body.should.have.length.of.at.least(1);
					return BlogPost.count();
				})
				.then(function(count) {
					res.body.should.have.length.of(count);
				});
		});

		it('should return blog posts with right fields', function() {
			let resBlogPosts;
			return chai.request(app)
			.get('/posts')
			.then(function(res) {
				res.should.have.status(200);
				res.should.be.json;
				res.body.should.be.a('array');
				res.body.should.have.length.of.at.least(1);
				res.body.forEach(function(post){
					post.should.be.a('object');
					post.should.include.keys(
						'title', 'author', 'content', 'created');
				});
				resBlogPosts = res.body[0];
				return BlogPost.findById(resBlogPosts.id);
			})
			.then(function(post) {
				//so, can i reference 'post' here because it was returned in the previous '.then'?
				resBlogPosts.id.should.equal(post.id);
				resBlogPosts.title.should.equal(post.title);
				resBlogPosts.author.should.equal(post.authorName); /*errors here*/
				resBlogPosts.content.should.equal(post.content);
			});
		});
	});

	describe('POST endpoint', function() {
		it('should add a new blog post', function() {
			const newBlogPost = generateBlogData();
			return chai.request(app)
				.post('/posts')
				.send(newBlogPost)
				.then(function(res) {
					res.should.have.status(201);
					res.should.be.json;
					res.body.should.be.a('object');
					res.body.should.include.keys(
						'title', 'author', 'content', 'created');
					res.body.title.should.equal(newBlogPost.title);
					res.body.author.should.equal(newBlogPost.author.firstName + " " + newBlogPost.author.lastName);
					res.body.content.should.equal(newBlogPost.content);
					res.body.id.should.not.be.null;
					return BlogPost.findById(res.body.id);
				})
				.then(function(post) {
					post.title.should.equal(newBlogPost.title);
					post.author.firstName.should.equal(newBlogPost.author.firstName);
					post.author.lastName.should.equal(newBlogPost.author.lastName);
					post.content.should.equal(newBlogPost.content);
				});
		});
	});

	describe('PUT endpoint', function() {
		it('should update fields you send over', function() {
			const updateData = {
				title: "This is a PUT test title change",
				content: "This content should have changed to match this paragraph"
			};

			return BlogPost
				.findOne()
				.exec()
				.then(function(post) {
					updateData.id = post.id;
					return chai.request(app)
						.put(`/posts/${post.id}`)
						.send(updateData);
				})
				.then(function(res) {
					res.should.have.status(201);
					return BlogPost.findById(updateData.id).exec();
				})
				.then(function(post) {
					post.title.should.equal(updateData.title);
					post.content.should.equal(updateData.content);
				});
		});
	});

	describe('DELETE endpoint', function() {
		it('deletes a post by id', function() {
			let blogpost
			return BlogPost
				.findOne()
				.exec()
				.then(function(_post) {
					post = _post;
					//again with the underscoring...
					return chai.request(app).delete(`/posts/${post.id}`);
				})
				.then(function(res) {
					res.should.have.status(204);
					return BlogPost.findById(post.id).exec();
				})
				.then(function(_post) {
					should.not.exist(_post);
				});
		});
	});
});
