  module.exports = (router, db) => {
    // Get all tags
    router.get('/tags/', async (ctx) => {
      await new Promise((resolve, reject) => {
        db.all('SELECT * FROM tags', [], (err, rows) => {
          if (err) {
            reject(err);
          }
          ctx.body = rows.map(tag => ({
            ...tag,
            url: `http://${ctx.host}/tags/${tag.id}`
          }));
          resolve();
        });
      });
    });

    // Delete all tags
    router.del('/tags/', async (ctx) => {
      await new Promise((resolve, reject) => {
        db.run('DELETE FROM tags', [], (err) => {
          if (err) {
            reject(err);
          }
          ctx.status = 204;
          resolve();
        });
      });
    });
  // Create a new tag
  router.post('/tags/', async (ctx) => {
    const { title } = ctx.request.body;
    if (!title) ctx.throw(400, { error: '"title" is a required field' });

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO tags (title) VALUES (?)`,
        [title],
        function (err) {
          if (err) {
            reject(err);
          }
          const newTag = { id: this.lastID, title };
          newTag.url = `http://${ctx.host}/tags/${newTag.id}`; // Assign URL dynamically
          ctx.status = 201;
          ctx.body = newTag;
          resolve();
        }
      );
    });
  });

  // GET /tags/:id
  router.get('/tags/:id', async (ctx) => {
    const { id } = ctx.params;

    // Retrieve the tag information
    const tag = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM tags WHERE id = ?`, [id], (err, row) => {
        if (err) {
          console.error('Database error while fetching tag:', err.stack || err);
          reject(err);
          return;
        }
        resolve(row);
      });
    });

    if (!tag) {
      ctx.status = 404;
      ctx.body = { message: 'Tag not found' };
      return;
    }

    // Retrieve associated todos for this tag
    const todos = await new Promise((resolve, reject) => {
      db.all(
        `SELECT todos.id, todos.title, todos.task_order, todos.completed 
        FROM todos 
        INNER JOIN todo_tags ON todos.id = todo_tags.todo_id 
        WHERE todo_tags.tag_id = ?`,
        [id],
        (err, rows) => {
          if (err) {
            console.error('Database error while fetching todos for tag:', err.stack || err);
            reject(err);
            return;
          }
          resolve(rows);
        }
      );
    });

    // Format the todos to match the expected structure
    const formattedTodos = todos.map((todo) => ({
      id: Number(todo.id),
      title: todo.title,
      order: todo.task_order,
      completed: todo.completed === 1, // Convert to boolean
      url: `http://${ctx.host}/todos/${todo.id}`,
    }));

    // Construct the response object for the tag with its associated todos
    const result = {
      id: Number(tag.id),
      title: tag.title,
      url: `http://${ctx.host}/tags/${tag.id}`,
      todos: formattedTodos, // Include the list of associated todos
    };

    ctx.body = result;
  });
  // Update a tag by ID
  router.patch('/tags/:id', async (ctx) => {
    const id = ctx.params.id;
    const { title } = ctx.request.body;

    if (!title) {
      ctx.throw(400, { error: '"title" is a required field' });
      return;
    }

    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE tags SET title = ? WHERE id = ?',
        [title, id],
        function (err) {
          if (err) {
            reject(err);
            return;
          }
          if (this.changes === 0) {
            ctx.throw(404, { error: 'Tag not found' });
            return;
          }

          // Fetch the updated tag
          db.get('SELECT * FROM tags WHERE id = ?', [id], (err, tag) => {
            if (err) {
              reject(err);
              return;
            }
            if (!tag) {
              ctx.throw(404, { error: 'Tag not found' });
              return;
            }

            // Return the updated tag object
            ctx.body = {
              id: Number(tag.id),
              title: tag.title,
              url: `http://${ctx.host}/tags/${tag.id}`,
            };
            resolve();
          });
        }
      );
    });
  });

    // Delete a tag by ID
    router.del('/tags/:id', async (ctx) => {
      const id = ctx.params.id;

      await new Promise((resolve, reject) => {
        db.run('DELETE FROM tags WHERE id = ?', [id], function (err) {
          if (err) {
            reject(err);
          }
          if (this.changes === 0) ctx.throw(404, { error: 'Tag not found' });

          // Remove associations in todo_tags table
          db.run('DELETE FROM todo_tags WHERE tag_id = ?', [id], function (err) {
            if (err) {
              reject(err);
            }
            ctx.status = 204;
            resolve();
          });
        });
      });
    });

    // Get a list of todos associated with a tag
    router.get('/tags/:id/todos', async (ctx) => {
      const tagId = ctx.params.id;

      await new Promise((resolve, reject) => {
        db.all(
          `SELECT todos.* FROM todos 
          INNER JOIN todo_tags ON todos.id = todo_tags.todo_id 
          WHERE todo_tags.tag_id = ?`,
          [tagId],
          (err, rows) => {
            if (err) {
              reject(err);
            }
            ctx.body = rows.map(todo => ({ ...todo, id: Number(todo.id) }));
            resolve();
          }
        );
      });
    });
  };