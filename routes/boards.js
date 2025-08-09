/**
 * 파일명: boards.js
 * 목적: 게시판 시스템 라우트 처리
 * 기능:
 * - 게시판 목록 조회
 * - 게시글 작성/수정/삭제
 * - 댓글 관리
 * - 파일 첨부 기능
 * - 좋아요/싫어요 기능
 * - 신고 기능
 * - 관리자 대시보드 및 신고 관리
 * - 권한 검증 및 보안 처리
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { Board, Post, Comment, Report } = require('../models/Board');
const User = require('../models/User');
const Log = require('../models/Log');

// 로그인 체크 미들웨어
function isLoggedIn(req, res, next) {
  if (req.session.userId) {
    next();
  } else {
    res.redirect('/auth/login');
  }
}

// 관리자 권한 체크
function adminOnly(req, res, next) {
  if (req.session.userRole === 'admin') {
    next();
  } else {
    res.status(403).send('관리자만 접근 가능합니다.');
  }
}

// 파일 업로드 설정
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/board/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB 제한
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('지원하지 않는 파일 형식입니다.'));
    }
  }
});

// 관리자용 신고 목록 - 가장 먼저 정의
router.get('/admin/reports', adminOnly, async (req, res) => {
  try {
    const { page = 1, status = '', type = '' } = req.query;
    const limit = 20;
    const skip = (page - 1) * limit;

    let query = {};
    if (status) query.status = status;
    if (type) query.targetType = type;

    const reports = await Report.find(query)
      .populate('reporter', 'username name')
      .populate('processedBy', 'username name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalReports = await Report.countDocuments(query);
    const totalPages = Math.ceil(totalReports / limit);

    res.render('boards/admin/reports', {
      reports,
      currentPage: parseInt(page),
      totalPages,
      status,
      type,
      session: req.session 
    });
  } catch (error) {
    console.error('신고 목록 조회 오류:', error);
    res.status(500).send('신고 목록을 불러오는 중 오류가 발생했습니다.');
  }
});

// 관리자용 신고 처리
router.post('/admin/reports/:reportId/process', adminOnly, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { action, adminNote } = req.body;

    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).send('신고를 찾을 수 없습니다.');
    }

    report.status = action; // 'reviewed', 'resolved', 'dismissed'
    report.adminNote = adminNote;
    report.processedBy = req.session.userId;
    report.processedAt = new Date();

    await report.save();

    // 신고가 해결된 경우 대상 게시글/댓글 숨김 처리
    if (action === 'resolved') {
      if (report.targetType === 'post') {
        await Post.findByIdAndUpdate(report.targetId, { isHidden: true });
      } else if (report.targetType === 'comment') {
        await Comment.findByIdAndUpdate(report.targetId, { isHidden: true });
      }
    }

    res.json({ success: true, message: '신고가 처리되었습니다.' });
  } catch (error) {
    console.error('신고 처리 오류:', error);
    res.status(500).json({ error: '신고 처리 중 오류가 발생했습니다.' });
  }
});

// 관리자용 통계 대시보드
router.get('/admin/dashboard', adminOnly, async (req, res) => {
  try {
    // 전체 통계
    const totalPosts = await Post.countDocuments();
    const totalComments = await Comment.countDocuments();
    const totalReports = await Report.countDocuments();
    const pendingReports = await Report.countDocuments({ status: 'pending' });

    // 최근 7일 통계
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentPosts = await Post.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
    const recentComments = await Comment.countDocuments({ createdAt: { $gte: sevenDaysAgo } });
    const recentReports = await Report.countDocuments({ createdAt: { $gte: sevenDaysAgo } });

    // 게시판별 통계
    const boardStats = await Post.aggregate([
      {
        $group: {
          _id: '$boardId',
          count: { $sum: 1 },
          totalViews: { $sum: '$views' },
          totalLikes: { $sum: { $size: '$likes' } },
          totalDislikes: { $sum: { $size: '$dislikes' } }
        }
      },
      {
        $lookup: {
          from: 'boards',
          localField: '_id',
          foreignField: '_id',
          as: 'board'
        }
      },
      {
        $unwind: '$board'
      },
      {
        $project: {
          boardName: '$board.name',
          boardType: '$board.type',
          postCount: '$count',
          totalViews: '$totalViews',
          totalLikes: '$totalLikes',
          totalDislikes: '$totalDislikes'
        }
      }
    ]);

    // 인기 게시글 (조회수 기준)
    const popularPosts = await Post.find({ isHidden: false })
      .populate('author', 'username name')
      .populate('boardId', 'name')
      .sort({ views: -1 })
      .limit(10);

    // 신고 통계
    const reportStats = await Report.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const reportReasonStats = await Report.aggregate([
      {
        $group: {
          _id: '$reason',
          count: { $sum: 1 }
        }
      }
    ]);

    res.render('boards/admin/dashboard', {
      stats: {
        total: { posts: totalPosts, comments: totalComments, reports: totalReports, pendingReports },
        recent: { posts: recentPosts, comments: recentComments, reports: recentReports },
        boardStats,
        popularPosts,
        reportStats,
        reportReasonStats
      },
      session: req.session
    });
  } catch (error) {
    console.error('대시보드 통계 조회 오류:', error);
    res.status(500).send('통계를 불러오는 중 오류가 발생했습니다.');
  }
});

// 게시판 목록
router.get('/', isLoggedIn, async (req, res) => {
  try {
    let boards = await Board.find({ isActive: true }).sort({ order: 1, createdAt: 1 });
    
    // 관리자가 아닌 경우 게시판 필터링
    if (req.session.userRole !== 'admin') {
      boards = boards.filter(board => {
        // 공지사항과 자유게시판은 모든 사용자에게 표시
        if (board.type === 'notice' || board.type === 'free') {
          return true;
        }
        // 부서별 게시판은 본인 부서만 표시
        if (board.type === 'department' && board.department === req.session.userDepartment) {
          return true;
        }
        return false;
      });
    }
    
    res.render('boards/index', { boards, session: req.session });
  } catch (error) {
    console.error('게시판 목록 조회 오류:', error);
    res.status(500).send('게시판 목록을 불러오는 중 오류가 발생했습니다.');
  }
});

// 게시판별 게시글 목록
router.get('/:boardId', isLoggedIn, async (req, res) => {
  try {
    const { boardId } = req.params;
    const { page = 1, search = '', sort = 'latest' } = req.query;
    const limit = 10;
    const skip = (page - 1) * limit;

    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).send('게시판을 찾을 수 없습니다.');
    }

    // 권한 체크 (관리자는 모든 게시판 접근 가능)
    console.log('게시판 접근 권한 체크:', {
      boardName: board.name,
      boardDepartment: board.department,
      userDepartment: req.session.userDepartment,
      userRole: req.session.userRole,
      readPermission: board.readPermission
    });
    
    if (board.readPermission === 'department' && req.session.userDepartment !== board.department && req.session.userRole !== 'admin') {
      return res.status(403).send(`해당 부서 게시판에 접근할 권한이 없습니다. (사용자 부서: ${req.session.userDepartment}, 게시판 부서: ${board.department})`);
    }

    // 검색 조건 강화
    let query = { boardId, isHidden: false };
    if (search) {
      const searchTerms = search.trim().split(/\s+/).filter(term => term.length > 0);
      if (searchTerms.length > 0) {
        query.$or = [
          { title: { $regex: searchTerms.join('|'), $options: 'i' } },
          { content: { $regex: searchTerms.join('|'), $options: 'i' } },
          { authorName: { $regex: searchTerms.join('|'), $options: 'i' } },
          { searchKeywords: { $in: searchTerms.map(term => new RegExp(term, 'i')) } },
          { tags: { $in: searchTerms.map(term => new RegExp(term, 'i')) } }
        ];
      }
    }

    // 정렬 조건
    let sortOption = {};
    switch (sort) {
      case 'views':
        sortOption = { views: -1, createdAt: -1 };
        break;
      case 'likes':
        sortOption = { 'likes.length': -1, createdAt: -1 };
        break;
      default:
        sortOption = { isNotice: -1, createdAt: -1 };
    }

    const posts = await Post.find(query)
      .populate('author', 'username')
      .sort(sortOption)
      .skip(skip)
      .limit(limit);

    const totalPosts = await Post.countDocuments(query);
    const totalPages = Math.ceil(totalPosts / limit);

    res.render('boards/posts', { 
      board, 
      posts, 
      currentPage: parseInt(page), 
      totalPages, 
      search, 
      sort,
      session: req.session 
    });
  } catch (error) {
    console.error('게시글 목록 조회 오류:', error);
    res.status(500).send('게시글 목록을 불러오는 중 오류가 발생했습니다.');
  }
});

// 게시글 작성 폼
router.get('/:boardId/write', isLoggedIn, async (req, res) => {
  try {
    const { boardId } = req.params;
    const board = await Board.findById(boardId);
    
    if (!board) {
      return res.status(404).send('게시판을 찾을 수 없습니다.');
    }

    // 글쓰기 권한 체크
    if (board.writePermission === 'admin' && req.session.userRole !== 'admin') {
      return res.status(403).send('관리자만 글을 쓸 수 있습니다.');
    }

    // 부서별 게시판 글쓰기 권한 체크 (관리자 또는 해당 부서원만)
    if (board.writePermission === 'department') {
      const isAdmin = req.session.userRole === 'admin';
      const isSameDepartment = req.session.userDepartment === board.department;
      
      if (!isAdmin && !isSameDepartment) {
        return res.status(403).send('해당 부서원만 글을 쓸 수 있습니다.');
      }
    }

    res.render('boards/write', { board, session: req.session });
  } catch (error) {
    console.error('게시글 작성 폼 오류:', error);
    res.status(500).send('게시글 작성 폼을 불러오는 중 오류가 발생했습니다.');
  }
});

// 게시글 작성
router.post('/:boardId/write', isLoggedIn, upload.array('attachments', 5), async (req, res) => {
  try {
    const { boardId } = req.params;
    const { title, content, isNotice, isAnonymous, tags } = req.body;
    
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).send('게시판을 찾을 수 없습니다.');
    }

    // 권한 체크
    if (board.writePermission === 'admin' && req.session.userRole !== 'admin') {
      return res.status(403).send('관리자만 글을 쓸 수 있습니다.');
    }

    // 부서별 게시판 글쓰기 권한 체크 (관리자 또는 해당 부서원만)
    if (board.writePermission === 'department') {
      const isAdmin = req.session.userRole === 'admin';
      const isSameDepartment = req.session.userDepartment === board.department;
      
      if (!isAdmin && !isSameDepartment) {
        return res.status(403).send('해당 부서원만 글을 쓸 수 있습니다.');
      }
    }

    // 첨부파일 처리
    const attachments = [];
    if (req.files) {
      req.files.forEach(file => {
        attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          path: '/uploads/board/' + file.filename,
          size: file.size
        });
      });
    }

    // 사용자 정보 가져오기
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).send('사용자 정보를 찾을 수 없습니다.');
    }

    // 관리자가 공지사항 게시판에 공지사항을 작성하는 경우
    const isAdminNotice = req.session.userRole === 'admin' && 
                         board.type === 'notice' && 
                         isNotice === 'on';

    if (isAdminNotice) {
      // 모든 부서별 게시판에 동시에 공지사항 등록
      const departmentBoards = await Board.find({ type: 'department' });
      
      for (const deptBoard of departmentBoards) {
        const deptPost = new Post({
          boardId: deptBoard._id,
          author: req.session.userId,
          authorName: user.name || user.username,
          title: `[공지사항] ${title}`,
          content,
          isNotice: true,
          isAnonymous: false,
          attachments,
          tags: tags ? tags.split(',').map(tag => tag.trim()) : []
        });
        
        await deptPost.save();
      }

      // 원본 공지사항도 저장
      const post = new Post({
        boardId,
        author: req.session.userId,
        authorName: user.name || user.username,
        title,
        content,
        isNotice: true,
        isAnonymous: false,
        attachments,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : []
      });

      await post.save();

      // 로그 기록
      await Log.create({
        userId: req.session.userId,
        action: 'create',
        detail: `시스템 알림 작성: ${title} (모든 부서 게시판에 등록)`,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      req.session.message = '공지사항이 모든 부서 게시판에 등록되었습니다.';
    } else {
      // 일반 게시글 작성
      const post = new Post({
        boardId,
        author: req.session.userId,
        authorName: isAnonymous === 'on' ? '익명' : (user.name || user.username),
        title,
        content,
        isNotice: isNotice === 'on' && req.session.userRole === 'admin',
        isAnonymous: isAnonymous === 'on',
        attachments,
        tags: tags ? tags.split(',').map(tag => tag.trim()) : []
      });

      await post.save();

      // 로그 기록
      await Log.create({
        userId: req.session.userId,
        action: 'create',
        detail: `게시글 작성: ${title} (${board.name})`,
        ip: req.ip,
        userAgent: req.headers['user-agent']
      });

      req.session.message = '게시글이 작성되었습니다.';
    }

    res.redirect(`/boards/${boardId}`);
  } catch (error) {
    console.error('게시글 작성 오류:', error);
    res.status(500).send('게시글 작성 중 오류가 발생했습니다.');
  }
});

// 게시글 상세보기
router.get('/:boardId/:postId', isLoggedIn, async (req, res) => {
  try {
    const { boardId, postId } = req.params;
    
    const board = await Board.findById(boardId);
    if (!board) {
      return res.status(404).send('게시판을 찾을 수 없습니다.');
    }

    const post = await Post.findById(postId)
      .populate('author', 'username')
      .populate('likes', 'username')
      .populate('dislikes', 'username');

    if (!post) {
      return res.status(404).send('게시글을 찾을 수 없습니다.');
    }

    // 조회수 증가
    post.views += 1;
    await post.save();

    // 댓글 조회
    const comments = await Comment.find({ postId })
      .populate('author', 'username')
      .sort({ createdAt: 1 });

    res.render('boards/view', { board, post, comments, session: req.session });
  } catch (error) {
    console.error('게시글 상세보기 오류:', error);
    res.status(500).send('게시글을 불러오는 중 오류가 발생했습니다.');
  }
});

// 게시글 수정 폼
router.get('/:boardId/:postId/edit', isLoggedIn, async (req, res) => {
  try {
    const { boardId, postId } = req.params;
    
    const board = await Board.findById(boardId);
    const post = await Post.findById(postId);

    if (!board || !post) {
      return res.status(404).send('게시판 또는 게시글을 찾을 수 없습니다.');
    }

    // 수정 권한 체크
    if (post.author.toString() !== req.session.userId && req.session.userRole !== 'admin') {
      return res.status(403).send('게시글을 수정할 권한이 없습니다.');
    }

    res.render('boards/edit', { board, post, session: req.session });
  } catch (error) {
    console.error('게시글 수정 폼 오류:', error);
    res.status(500).send('게시글 수정 폼을 불러오는 중 오류가 발생했습니다.');
  }
});

// 게시글 수정
router.put('/:boardId/:postId', isLoggedIn, upload.array('attachments', 5), async (req, res) => {
  try {
    const { boardId, postId } = req.params;
    const { title, content, isNotice, isAnonymous, tags } = req.body;
    
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).send('게시글을 찾을 수 없습니다.');
    }

    // 수정 권한 체크
    if (post.author.toString() !== req.session.userId && req.session.userRole !== 'admin') {
      return res.status(403).send('게시글을 수정할 권한이 없습니다.');
    }

    // 첨부파일 처리
    const attachments = post.attachments || [];
    if (req.files) {
      req.files.forEach(file => {
        attachments.push({
          filename: file.filename,
          originalName: file.originalname,
          path: '/uploads/board/' + file.filename,
          size: file.size
        });
      });
    }

    post.title = title;
    post.content = content;
    post.isNotice = isNotice === 'on' && req.session.userRole === 'admin';
    post.isAnonymous = isAnonymous === 'on';
    post.attachments = attachments;
    post.tags = tags ? tags.split(',').map(tag => tag.trim()) : [];

    await post.save();

    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'update',
      detail: `게시글 수정: ${title}`,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    req.session.message = '게시글이 수정되었습니다.';
    res.redirect(`/boards/${boardId}/${postId}`);
  } catch (error) {
    console.error('게시글 수정 오류:', error);
    res.status(500).send('게시글 수정 중 오류가 발생했습니다.');
  }
});

// 게시글 삭제
router.delete('/:boardId/:postId', isLoggedIn, async (req, res) => {
  try {
    const { boardId, postId } = req.params;
    
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).send('게시글을 찾을 수 없습니다.');
    }

    // 삭제 권한 체크
    if (post.author.toString() !== req.session.userId && req.session.userRole !== 'admin') {
      return res.status(403).send('게시글을 삭제할 권한이 없습니다.');
    }

    // 댓글도 함께 삭제
    await Comment.deleteMany({ postId });

    await Post.findByIdAndDelete(postId);

    // 로그 기록
    await Log.create({
      userId: req.session.userId,
      action: 'delete',
      detail: `게시글 삭제: ${post.title}`,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    req.session.message = '게시글이 삭제되었습니다.';
    res.redirect(`/boards/${boardId}`);
  } catch (error) {
    console.error('게시글 삭제 오류:', error);
    res.status(500).send('게시글 삭제 중 오류가 발생했습니다.');
  }
});

// 댓글 작성
router.post('/:boardId/:postId/comment', isLoggedIn, async (req, res) => {
  try {
    const { boardId, postId } = req.params;
    const { content, isAnonymous, parentComment } = req.body;
    
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).send('게시글을 찾을 수 없습니다.');
    }

    // 사용자 정보 가져오기
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).send('사용자 정보를 찾을 수 없습니다.');
    }

    const comment = new Comment({
      postId,
      author: req.session.userId,
      authorName: isAnonymous === 'on' ? '익명' : (user.name || user.username),
      content,
      isAnonymous: isAnonymous === 'on',
      parentComment: parentComment || null
    });

    await comment.save();

    req.session.message = '댓글이 작성되었습니다.';
    res.redirect(`/boards/${boardId}/${postId}`);
  } catch (error) {
    console.error('댓글 작성 오류:', error);
    res.status(500).send('댓글 작성 중 오류가 발생했습니다.');
  }
});

// 댓글 삭제
router.delete('/:boardId/:postId/comment/:commentId', isLoggedIn, async (req, res) => {
  try {
    const { commentId } = req.params;
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).send('댓글을 찾을 수 없습니다.');
    }

    // 삭제 권한 체크
    if (comment.author.toString() !== req.session.userId && req.session.userRole !== 'admin') {
      return res.status(403).send('댓글을 삭제할 권한이 없습니다.');
    }

    await Comment.findByIdAndDelete(commentId);

    req.session.message = '댓글이 삭제되었습니다.';
    res.redirect('back');
  } catch (error) {
    console.error('댓글 삭제 오류:', error);
    res.status(500).send('댓글 삭제 중 오류가 발생했습니다.');
  }
});

// 좋아요/싫어요
router.post('/:boardId/:postId/like', isLoggedIn, async (req, res) => {
  try {
    const { postId } = req.params;
    const { action } = req.body; // 'like' or 'dislike'
    
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).send('게시글을 찾을 수 없습니다.');
    }

    const userId = req.session.userId;

    if (action === 'like') {
      if (post.likes.includes(userId)) {
        post.likes = post.likes.filter(id => id.toString() !== userId);
      } else {
        post.likes.push(userId);
        post.dislikes = post.dislikes.filter(id => id.toString() !== userId);
      }
    } else if (action === 'dislike') {
      if (post.dislikes.includes(userId)) {
        post.dislikes = post.dislikes.filter(id => id.toString() !== userId);
      } else {
        post.dislikes.push(userId);
        post.likes = post.likes.filter(id => id.toString() !== userId);
      }
    }

    await post.save();
    res.json({ 
      likes: post.likes.length, 
      dislikes: post.dislikes.length,
      userLiked: post.likes.includes(userId),
      userDisliked: post.dislikes.includes(userId)
    });
  } catch (error) {
    console.error('좋아요/싫어요 오류:', error);
    res.status(500).json({ error: '처리 중 오류가 발생했습니다.' });
  }
});

// 신고 기능
router.post('/:boardId/:postId/report', isLoggedIn, async (req, res) => {
  try {
    const { postId } = req.params;
    const { reason, description } = req.body;
    
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).send('게시글을 찾을 수 없습니다.');
    }

    // 사용자 정보 가져오기
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).send('사용자 정보를 찾을 수 없습니다.');
    }

    // 이미 신고했는지 확인
    const existingReport = await Report.findOne({
      reporter: req.session.userId,
      targetType: 'post',
      targetId: postId
    });

    if (existingReport) {
      return res.status(400).json({ error: '이미 신고한 게시글입니다.' });
    }

    const report = new Report({
      reporter: req.session.userId,
      reporterName: user.name || user.username,
      targetType: 'post',
      targetId: postId,
      reason,
      description
    });

    await report.save();

    // 게시글 신고 수 증가
    post.reportCount += 1;
    await post.save();

    res.json({ success: true, message: '신고가 접수되었습니다.' });
  } catch (error) {
    console.error('게시글 신고 오류:', error);
    res.status(500).json({ error: '신고 처리 중 오류가 발생했습니다.' });
  }
});

// 댓글 신고 기능
router.post('/:boardId/:postId/comment/:commentId/report', isLoggedIn, async (req, res) => {
  try {
    const { commentId } = req.params;
    const { reason, description } = req.body;
    
    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).send('댓글을 찾을 수 없습니다.');
    }

    // 사용자 정보 가져오기
    const user = await User.findById(req.session.userId);
    if (!user) {
      return res.status(404).send('사용자 정보를 찾을 수 없습니다.');
    }

    // 이미 신고했는지 확인
    const existingReport = await Report.findOne({
      reporter: req.session.userId,
      targetType: 'comment',
      targetId: commentId
    });

    if (existingReport) {
      return res.status(400).json({ error: '이미 신고한 댓글입니다.' });
    }

    const report = new Report({
      reporter: req.session.userId,
      reporterName: user.name || user.username,
      targetType: 'comment',
      targetId: commentId,
      reason,
      description
    });

    await report.save();

    // 댓글 신고 수 증가
    comment.reportCount += 1;
    await comment.save();

    res.json({ success: true, message: '신고가 접수되었습니다.' });
  } catch (error) {
    console.error('댓글 신고 오류:', error);
    res.status(500).json({ error: '신고 처리 중 오류가 발생했습니다.' });
  }
});

module.exports = router; 